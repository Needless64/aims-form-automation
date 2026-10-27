import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleEnquiry } from "@/lib/api/enquiries";
import { handleRetry } from "@/lib/api/retry";
import { resetSmtpTransports } from "@/lib/email/provider";
import {
  minimalRequestBody,
  validRequestBody,
} from "./fixtures";

const { sendMailMock, createTransportMock } = vi.hoisted(() => {
  const sendMail = vi.fn();
  return {
    sendMailMock: sendMail,
    createTransportMock: vi.fn(() => ({ sendMail })),
  };
});

vi.mock("nodemailer", () => ({
  default: { createTransport: createTransportMock },
}));

// The handlers take their configuration as an argument; these wrappers leave it
// at the default process.env, which vi.stubEnv below controls per test.
const enquiryPOST = (request: Request) => handleEnquiry(request);
const retryPOST = (request: Request) => handleRetry(request);

function enquiryRequest(
  body: unknown,
  ip: string,
  headers: Record<string, string> = {},
) {
  return new Request("http://localhost/api/enquiries", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": ip,
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function retryRequest(referenceId: string, token = "retry-secret") {
  return new Request("http://localhost/api/admissions/retry", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ referenceId }),
  });
}

function stubMailbox() {
  sendMailMock.mockReset();
  sendMailMock.mockResolvedValue({ messageId: "<sent@example.com>" });
  return sendMailMock;
}

interface SentMail {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  messageId?: string;
}

function sentMessages() {
  return sendMailMock.mock.calls.map((call) => call[0] as SentMail);
}

beforeEach(() => {
  resetSmtpTransports();
  stubMailbox();
  vi.stubEnv("SMTP_USER", "admissions@mail.aims-test.example");
  vi.stubEnv("SMTP_APP_PASSWORD", "app-password-value");
  vi.stubEnv("SMTP_HOST", "smtp.mail.aims-test.example");
  vi.stubEnv(
    "EMAIL_FROM",
    "AIMS Admissions <admissions@mail.aims-test.example>",
  );
  vi.stubEnv("ADMISSIONS_EMAIL", "admissions@aims.ac.in");
  vi.stubEnv("ADMIN_RETRY_TOKEN", "retry-secret");
});

describe("POST /api/enquiries", () => {
  it("sends both emails and returns a success response with a reference ID", async () => {
    const response = await enquiryPOST(
      enquiryRequest(validRequestBody, "198.51.100.10"),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.referenceId).toMatch(/^AIMS-\d{2}-[A-HJ-NP-Z2-9]{6}$/);
    expect(data.deliveries).toEqual({
      student: "accepted",
      admissions: "accepted",
    });
    expect(sendMailMock).toHaveBeenCalledTimes(2);

    const messages = sentMessages();
    expect(messages[0].to).toBe("ananya.rao@example.com");
    expect(messages[0].from).toBe(
      "AIMS Admissions <admissions@mail.aims-test.example>",
    );
    expect(messages[0].subject).toContain("Ananya Rao");
    expect(messages[0].replyTo).toBeUndefined();

    expect(messages[1].to).toBe("admissions@aims.ac.in");
    expect(messages[1].replyTo).toBe("ananya.rao@example.com");
    expect(messages[1].subject).toContain(data.referenceId);

    for (const message of messages) {
      expect(message.html).toContain(data.referenceId);
      expect(message.text).toContain(data.referenceId);
      expect(message.messageId).toBeTruthy();
    }

    expect(new Set(messages.map((message) => message.messageId)).size).toBe(2);
  });

  it("gives identical submissions distinct reference IDs", async () => {
    const first = await (
      await enquiryPOST(
        enquiryRequest(minimalRequestBody(), "198.51.100.17"),
      )
    ).json();
    const second = await (
      await enquiryPOST(
        enquiryRequest(minimalRequestBody(), "198.51.100.18"),
      )
    ).json();

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(first.referenceId).not.toBe(second.referenceId);
  });

  it("returns 422 with field errors for invalid input and sends nothing", async () => {
    const response = await enquiryPOST(
      enquiryRequest(
        minimalRequestBody({ email: "not-an-email", phone: "12345" }),
        "198.51.100.11",
      ),
    );
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(data.ok).toBe(false);
    expect(data.fieldErrors.email).toMatch(/email/i);
    expect(data.fieldErrors.phone).toMatch(/mobile/i);
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it("silently rejects honeypot submissions without sending email", async () => {
    const response = await enquiryPOST(
      enquiryRequest(
        { ...minimalRequestBody(), companyWebsite: "https://spam.example" },
        "198.51.100.12",
      ),
    );
    expect(response.status).toBe(400);
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it("rate limits repeated submissions from one connection", async () => {
    const ip = "198.51.100.13";

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await enquiryPOST(enquiryRequest(minimalRequestBody(), ip));
      expect(response.status).toBe(200);
    }

    const blocked = await enquiryPOST(enquiryRequest(minimalRequestBody(), ip));
    const data = await blocked.json();
    expect(blocked.status).toBe(429);
    expect(data.error).toBe("rate_limited");
    expect(blocked.headers.get("Retry-After")).toBeTruthy();
  });

  it("returns 503 instead of a false success when email is unconfigured", async () => {
    vi.stubEnv("SMTP_APP_PASSWORD", "");
    const response = await enquiryPOST(
      enquiryRequest(minimalRequestBody(), "198.51.100.14"),
    );
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.ok).toBe(false);
    expect(data.error).toBe("email_not_configured");
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it("returns 502 when the mail server rejects the app password", async () => {
    sendMailMock.mockRejectedValue(
      Object.assign(new Error("Invalid login"), { code: "EAUTH" }),
    );
    const response = await enquiryPOST(
      enquiryRequest(minimalRequestBody(), "198.51.100.19"),
    );
    const data = await response.json();

    expect(response.status).toBe(502);
    expect(data.ok).toBe(false);
    expect(data.deliveries).toEqual({
      student: "failed",
      admissions: "failed",
    });
    expect(JSON.stringify(data)).not.toContain("Invalid login");
  });

  it("rejects non-JSON and oversized payloads", async () => {
    const wrongType = await enquiryPOST(
      new Request("http://localhost/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "text/plain", "x-forwarded-for": "198.51.100.15" },
        body: "hello",
      }),
    );
    expect(wrongType.status).toBe(415);

    const tooLarge = await enquiryPOST(
      new Request("http://localhost/api/enquiries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "198.51.100.16",
        },
        body: JSON.stringify(minimalRequestBody({ goals: "x".repeat(20_000) })),
      }),
    );
    expect(tooLarge.status).toBe(413);
  });
});

describe("spreadsheet ledger", () => {
  const webhook = "https://script.google.com/macros/s/AKfycbx/exec";

  function stubSheet() {
    const mock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", mock);
    vi.stubEnv("SHEETS_WEBHOOK_URL", webhook);
    vi.stubEnv("SHEETS_WEBHOOK_SECRET", "ledger-secret");
    return mock;
  }

  it("records the enquiry in the sheet and still sends both emails", async () => {
    const fetchMock = stubSheet();

    const response = await enquiryPOST(
      enquiryRequest(validRequestBody, "198.51.100.30"),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.recorded).toBe("saved");
    expect(sendMailMock).toHaveBeenCalledTimes(2);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(webhook);
    const body = JSON.parse(String(init.body)) as {
      token: string;
      values: string[];
    };
    expect(body.token).toBe("ledger-secret");
    expect(body.values).toContain(data.referenceId);
    expect(body.values).toContain("Ananya Rao");
    expect(body.values).toContain("ananya.rao@example.com");
  });

  it("never fails a student's enquiry because the ledger is down", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 503 })),
    );
    vi.stubEnv("SHEETS_WEBHOOK_URL", webhook);

    const response = await enquiryPOST(
      enquiryRequest(validRequestBody, "198.51.100.31"),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.recorded).toBe("failed");
    expect(sendMailMock).toHaveBeenCalledTimes(2);
  });

  it("reports the ledger as off when no webhook is configured", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await enquiryPOST(
      enquiryRequest(validRequestBody, "198.51.100.32"),
    );
    const data = await response.json();

    expect(data.recorded).toBe("skipped");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("validations and honeypots never reach the sheet", async () => {
    const fetchMock = stubSheet();

    await enquiryPOST(
      enquiryRequest(minimalRequestBody({ phone: "12345" }), "198.51.100.33"),
    );
    await enquiryPOST(
      enquiryRequest(
        { ...minimalRequestBody(), companyWebsite: "https://spam.example" },
        "198.51.100.34",
      ),
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("partial failure and controlled retry", () => {
  it("reports partial failure honestly, then retries only the failed leg", async () => {
    sendMailMock
      .mockResolvedValueOnce({ messageId: "<student@example.com>" })
      .mockRejectedValueOnce(
        Object.assign(new Error("mailbox unavailable"), { responseCode: 550 }),
      );

    const response = await enquiryPOST(
      enquiryRequest(minimalRequestBody({ email: "retry@example.com" }), "198.51.100.20"),
    );
    const data = await response.json();

    expect(response.status).toBe(502);
    expect(data.ok).toBe(false);
    expect(data.partial).toBe(true);
    expect(data.referenceId).toMatch(/^AIMS-/);
    expect(data.deliveries).toEqual({
      student: "accepted",
      admissions: "failed",
    });

    // Retry: only the admissions leg should be attempted.
    sendMailMock.mockReset();
    sendMailMock.mockResolvedValue({ messageId: "<admin-retry@example.com>" });

    const retryResponse = await retryPOST(retryRequest(data.referenceId));
    const retryData = await retryResponse.json();

    expect(retryResponse.status).toBe(200);
    expect(retryData.ok).toBe(true);
    expect(retryData.deliveries).toEqual({
      student: "accepted",
      admissions: "accepted",
    });
    expect(sendMailMock).toHaveBeenCalledTimes(1);

    const [retriedMessage] = sentMessages();
    expect(retriedMessage.to).toBe("admissions@aims.ac.in");
    expect(retriedMessage.replyTo).toBe("retry@example.com");
    expect(retriedMessage.subject).toContain(data.referenceId);

    // A second retry must not send anything again.
    sendMailMock.mockClear();
    const duplicate = await retryPOST(retryRequest(data.referenceId));
    expect(duplicate.status).toBe(409);
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it("requires the admin bearer token", async () => {
    const response = await retryPOST(
      retryRequest("AIMS-26-ABCDEF", "wrong-token"),
    );
    expect(response.status).toBe(401);
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown reference", async () => {
    const response = await retryPOST(retryRequest("AIMS-26-ZZZZZZ"));
    expect(response.status).toBe(404);
  });
});
