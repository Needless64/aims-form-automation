import { describe, expect, it, vi } from "vitest";
import { handleEnquiry } from "@/lib/api/enquiries";
import { handleRetry } from "@/lib/api/retry";
import type { GitHubDispatchConfig } from "@/lib/email/config";
import {
  createGitHubDispatcher,
  queueEnquiryEmails,
  type Dispatcher,
} from "@/lib/email/dispatch";
import { generateMailPayloadKey, openMailPayload } from "@/lib/mail-payload";
import { minimalRequestBody, validEnquiry } from "./fixtures";

const payloadKey = generateMailPayloadKey();

const config: GitHubDispatchConfig = {
  repo: "Needless64/aims-form-automation",
  workflow: "send-enquiry-mail.yml",
  ref: "main",
  token: "github_pat_test",
  payloadKey,
};

const ENDPOINT =
  "https://api.github.com/repos/Needless64/aims-form-automation/actions/workflows/send-enquiry-mail.yml/dispatches";

const input = {
  enquiry: validEnquiry,
  referenceId: "AIMS-26-AB7K9Q",
  submittedAt: new Date("2026-10-27T13:12:00Z"),
};

/** The environment a deployed Worker would have for this transport. */
const serverEnv = {
  GITHUB_DISPATCH_REPO: config.repo,
  GITHUB_DISPATCH_TOKEN: config.token,
  MAIL_PAYLOAD_KEY: payloadKey,
  ADMISSIONS_EMAIL: "admissions@aims.ac.in",
  ADMIN_RETRY_TOKEN: "retry-secret",
};

function enquiryRequest(body: unknown, ip = "203.0.113.7") {
  return new Request("http://localhost/api/enquiries", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

function retryRequest(referenceId: string) {
  return new Request("http://localhost/api/admissions/retry", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer retry-secret",
    },
    body: JSON.stringify({ referenceId }),
  });
}

function acceptingFetcher() {
  const fetcher = vi.fn(async () => new Response(null, { status: 204 }));
  return fetcher as unknown as typeof fetch & {
    mock: { calls: [string, RequestInit][] };
  };
}

function sentPayload(fetcher: { mock: { calls: [string, RequestInit][] } }) {
  const [, init] = fetcher.mock.calls[0];
  return JSON.parse(String(init.body)) as {
    ref: string;
    inputs: { payload: string };
  };
}

describe("dispatching a job to the runner", () => {
  it("posts the sealed payload to the workflow, without the enquiry in clear text", async () => {
    const fetcher = acceptingFetcher();
    const dispatcher: Dispatcher = createGitHubDispatcher(config, {
      fetcher,
    });

    await dispatcher.dispatch(input);

    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe(ENDPOINT);
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer github_pat_test");
    expect(headers.Accept).toBe("application/vnd.github+json");

    const body = sentPayload(fetcher);
    expect(body.ref).toBe("main");
    expect(body.inputs.payload).not.toContain("Ananya");
    expect(body.inputs.payload).not.toContain("ananya.rao@example.com");

    const opened = await openMailPayload(body.inputs.payload, payloadKey);
    expect(opened.referenceId).toBe(input.referenceId);
    expect(opened.enquiry.fullName).toBe(validEnquiry.fullName);
    expect(opened.submittedAt).toBe(input.submittedAt.toISOString());
  });

  it("reports both legs as queued, never as delivered", async () => {
    const report = await queueEnquiryEmails(input, config, {
      fetcher: acceptingFetcher(),
    });

    expect(report).toEqual({
      student: { status: "queued" },
      admissions: { status: "queued" },
    });
  });

  it("reports a rejected token, a missing workflow and an outage distinctly", async () => {
    const cases: [number, string][] = [
      [401, "provider_auth_failed"],
      [403, "provider_auth_failed"],
      [404, "dispatch_target_missing"],
      [422, "dispatch_target_missing"],
      [503, "provider_unavailable"],
      [429, "provider_unavailable"],
    ];

    for (const [status, code] of cases) {
      const report = await queueEnquiryEmails(input, config, {
        fetcher: (async () => new Response("no", { status })) as typeof fetch,
      });
      expect(report.student).toEqual({ status: "failed", errorCode: code });
      expect(report.admissions).toEqual({ status: "failed", errorCode: code });
    }
  });

  it("reports an unreachable GitHub as a failure on both legs", async () => {
    const report = await queueEnquiryEmails(input, config, {
      fetcher: (async () => {
        throw Object.assign(new Error("connect ECONNREFUSED"), {
          name: "TypeError",
        });
      }) as typeof fetch,
    });

    expect(report.student).toEqual({
      status: "failed",
      errorCode: "provider_unreachable",
    });
    expect(report.admissions).toEqual({
      status: "failed",
      errorCode: "provider_unreachable",
    });
  });
});

describe("the enquiry handler with the GitHub transport", () => {
  it("accepts the enquiry once the job is queued", async () => {
    const fetcher = acceptingFetcher();
    vi.stubGlobal("fetch", fetcher);

    const response = await handleEnquiry(
      enquiryRequest(minimalRequestBody()),
      serverEnv,
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.referenceId).toMatch(/^AIMS-\d{2}-[A-Z2-9]{6}$/);
    expect(data.deliveries).toEqual({
      student: "queued",
      admissions: "queued",
    });
    // No ledger configured, and the student is told all the same.
    expect(data.recorded).toBe("skipped");
    expect(fetcher.mock.calls[0][0]).toBe(ENDPOINT);
  });

  it("never reports success when the job was refused", async () => {
    vi.stubGlobal(
      "fetch",
      (async () => new Response("forbidden", { status: 403 })) as typeof fetch,
    );

    const response = await handleEnquiry(
      enquiryRequest(minimalRequestBody(), "203.0.113.8"),
      serverEnv,
    );
    const data = await response.json();

    expect(response.status).toBe(502);
    expect(data.ok).toBe(false);
    expect(data.partial).toBe(false);
    expect(data.deliveries).toEqual({
      student: "failed",
      admissions: "failed",
    });
    expect(data.message).toContain("helpline");
  });

  it("sends nothing until the payload is sealed", async () => {
    const fetcher = acceptingFetcher();
    vi.stubGlobal("fetch", fetcher);

    await handleEnquiry(
      enquiryRequest(minimalRequestBody(), "203.0.113.9"),
      serverEnv,
    );

    const raw = String(fetcher.mock.calls[0][1].body);
    const submitted = minimalRequestBody();
    expect(raw).not.toContain(submitted.fullName);
    expect(raw).not.toContain(submitted.email);
    expect(raw).not.toContain(String(submitted.phone));
    expect(raw).not.toContain(String(submitted.parentName));
  });
});

describe("the retry endpoint with the GitHub transport", () => {
  it("re-dispatches a queued enquiry only when asked", async () => {
    const fetcher = acceptingFetcher();
    vi.stubGlobal("fetch", fetcher);

    const accepted = await handleEnquiry(
      enquiryRequest(minimalRequestBody(), "203.0.113.20"),
      serverEnv,
    );
    const { referenceId } = await accepted.json();
    expect(fetcher).toHaveBeenCalledTimes(1);

    const retry = await handleRetry(retryRequest(referenceId), serverEnv);
    const retryData = await retry.json();

    expect(retry.status).toBe(200);
    expect(retryData.ok).toBe(true);
    expect(retryData.deliveries).toEqual({
      student: "queued",
      admissions: "queued",
    });
    expect(fetcher).toHaveBeenCalledTimes(2);

    // A queued enquiry stays retryable on purpose: the runner can fail after
    // the site has already answered, and this is the only way staff can resend.
    // The cost is that a repeated retry can deliver a second copy.
    const again = await handleRetry(retryRequest(referenceId), serverEnv);
    expect(again.status).toBe(200);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("dispatches again after a failed dispatch", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response("down", { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetcher as unknown as typeof fetch);

    const failed = await handleEnquiry(
      enquiryRequest(minimalRequestBody(), "203.0.113.21"),
      serverEnv,
    );
    const { referenceId } = await failed.json();
    expect(failed.status).toBe(502);

    const retry = await handleRetry(retryRequest(referenceId), serverEnv);

    expect(retry.status).toBe(200);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
