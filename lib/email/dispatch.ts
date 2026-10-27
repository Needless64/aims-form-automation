// Sending mail from GitHub Actions instead of from the site: a Cloudflare
// Worker has no raw sockets, but a runner has, so the site hands the job over
// and the runner speaks SMTP with the same mailbox the site would have used.
//
// The work is asynchronous, so a successful dispatch means "queued", never
// "delivered" — see the `queued` delivery state in lib/email/service.ts.
import type { EmailConfig, GitHubDispatchConfig } from "@/lib/email/config";
import { createEmailProvider, EmailProviderError } from "@/lib/email/provider";
import {
  deliverEnquiryEmails,
  type DeliveryReport,
  type EnquiryEmailInput,
} from "@/lib/email/service";
import { sealMailPayload } from "@/lib/mail-payload";

const DEFAULT_TIMEOUT_MS = 15_000;

export interface DispatchOptions {
  timeoutMs?: number;
  fetcher?: typeof fetch;
}

export interface Dispatcher {
  /** Resolves once GitHub has accepted the job; it says nothing about delivery. */
  dispatch(input: EnquiryEmailInput): Promise<void>;
}

function mapDispatchError(error: unknown): EmailProviderError {
  const name = (error as { name?: unknown })?.name;
  if (name === "TimeoutError" || name === "AbortError") {
    return new EmailProviderError(
      "provider_timeout",
      "GitHub did not accept the mail job in time.",
    );
  }
  return new EmailProviderError(
    "provider_unreachable",
    "GitHub could not be reached.",
  );
}

export function createGitHubDispatcher(
  config: GitHubDispatchConfig,
  { timeoutMs = DEFAULT_TIMEOUT_MS, fetcher = fetch }: DispatchOptions = {},
): Dispatcher {
  const endpoint = `https://api.github.com/repos/${config.repo}/actions/workflows/${encodeURIComponent(config.workflow)}/dispatches`;

  return {
    async dispatch({ enquiry, referenceId, submittedAt }) {
      const payload = await sealMailPayload(
        {
          referenceId,
          submittedAt: submittedAt.toISOString(),
          enquiry,
        },
        config.payloadKey,
      );

      let response: Response;
      try {
        response = await fetcher(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.token}`,
            Accept: "application/vnd.github+json",
            "Content-Type": "application/json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "aims-admissions-site",
          },
          // The sealed payload is the only student data that leaves the site,
          // and only the token itself is readable in the run.
          body: JSON.stringify({ ref: config.ref, inputs: { payload } }),
          signal: AbortSignal.timeout(timeoutMs),
          cache: "no-store",
        });
      } catch (error) {
        throw mapDispatchError(error);
      }

      if (response.status === 401 || response.status === 403) {
        throw new EmailProviderError(
          "provider_auth_failed",
          "GitHub rejected the dispatch token. Check GITHUB_DISPATCH_TOKEN.",
        );
      }
      if (response.status === 404 || response.status === 422) {
        throw new EmailProviderError(
          "dispatch_target_missing",
          "The mail workflow could not be dispatched. Check GITHUB_DISPATCH_REPO and its workflow_dispatch trigger.",
        );
      }
      if (response.status === 429 || response.status >= 500) {
        throw new EmailProviderError(
          "provider_unavailable",
          "GitHub is temporarily unable to accept the mail job.",
        );
      }
      if (!response.ok) {
        throw new EmailProviderError(
          "dispatch_rejected",
          "GitHub refused the mail job.",
        );
      }
      // 204 No Content: the run has been created, nothing has been sent yet.
    },
  };
}

/**
 * Hands the enquiry to the runner and reports both legs as queued. A dispatch
 * failure is reported as a failure on both legs, because neither is on its way.
 */
export async function queueEnquiryEmails(
  input: EnquiryEmailInput,
  config: GitHubDispatchConfig,
  options: DispatchOptions = {},
): Promise<DeliveryReport> {
  try {
    await createGitHubDispatcher(config, options).dispatch(input);
    return { student: { status: "queued" }, admissions: { status: "queued" } };
  } catch (error) {
    const errorCode =
      error instanceof EmailProviderError ? error.code : "unknown_error";
    return {
      student: { status: "failed", errorCode },
      admissions: { status: "failed", errorCode },
    };
  }
}

/**
 * The single entry point callers use, so the enquiry handler and the retry
 * endpoint do not each repeat the transport branch: the site either sends both
 * emails itself or hands the job to the runner, and either way the caller gets
 * the same two-leg report.
 */
export async function deliverEnquiry(
  input: EnquiryEmailInput,
  config: EmailConfig,
): Promise<DeliveryReport> {
  if (config.transport === "github") {
    if (!config.github) {
      // Configuration validation makes this unreachable; fail loudly if not.
      throw new Error("GitHub transport selected without dispatch settings.");
    }
    return queueEnquiryEmails(input, config.github);
  }

  return deliverEnquiryEmails(input, {
    provider: createEmailProvider(config),
    from: config.from,
    admissionsEmail: config.admissionsEmail,
    logoUrl: config.logoUrl,
  });
}
