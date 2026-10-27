import { assertMailPayloadKey } from "@/lib/mail-payload";
import { INSTITUTION } from "@/lib/institution";

/**
 * The institution lockup — crest, wordmark and hospital line — on the navy the
 * brand band uses, so the image has no visible edges. It is opaque, so a change
 * of band colour must change with it (see EMAIL_COLORS.navyDeep).
 */
export const DEFAULT_EMAIL_LOGO_URL =
  "https://i.ibb.co/60XQBJ5R/Screenshot-2026-10-27-213641.png";

export type EmailTransport = "smtp" | "webhook" | "brevo" | "github";

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
}

export interface WebhookConfig {
  url: string;
  token: string;
}

export interface BrevoConfig {
  apiKey: string;
}

/** Mail is sent by a GitHub Actions runner, not by this runtime. */
export interface GitHubDispatchConfig {
  /** "owner/name" of the repository holding the workflow. */
  repo: string;
  /** Workflow file name, e.g. send-enquiry-mail.yml. */
  workflow: string;
  /** Branch or tag the workflow is dispatched from. */
  ref: string;
  /** Fine-grained token with Actions: write on that repository only. */
  token: string;
  /** Shared AES-GCM key that seals the payload for the runner. */
  payloadKey: string;
}

export interface EmailConfig {
  transport: EmailTransport;
  /** Set for the smtp transport, null otherwise. */
  smtp: SmtpConfig | null;
  /** Set for the webhook transport, null otherwise. */
  webhook: WebhookConfig | null;
  /** Set for the brevo transport, null otherwise. */
  brevo: BrevoConfig | null;
  /** Set for the github transport, null otherwise. */
  github: GitHubDispatchConfig | null;
  from: string;
  admissionsEmail: string;
  logoUrl: string;
}

export class EmailConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailConfigurationError";
  }
}

/**
 * Common mailbox providers, so an app-password setup only needs the address and
 * the password. Anything else must set SMTP_HOST explicitly.
 */
const SMTP_PRESETS: Record<string, { host: string; port: number }> = {
  "gmail.com": { host: "smtp.gmail.com", port: 465 },
  "googlemail.com": { host: "smtp.gmail.com", port: 465 },
  "outlook.com": { host: "smtp-mail.outlook.com", port: 587 },
  "hotmail.com": { host: "smtp-mail.outlook.com", port: 587 },
  "live.com": { host: "smtp-mail.outlook.com", port: 587 },
  "msn.com": { host: "smtp-mail.outlook.com", port: 587 },
  "yahoo.com": { host: "smtp.mail.yahoo.com", port: 465 },
  "yahoo.co.in": { host: "smtp.mail.yahoo.com", port: 465 },
  "zoho.com": { host: "smtp.zoho.com", port: 465 },
  "zohomail.in": { host: "smtp.zoho.in", port: 465 },
};

const ADDRESS_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const REPO_PATTERN = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/;
const WORKFLOW_PATTERN = /^[A-Za-z0-9._-]+\.ya?ml$/;
const REF_PATTERN = /^[A-Za-z0-9._/-]+$/;

function addressOf(value: string): string {
  return (value.match(/<([^>]+)>/)?.[1] ?? value).trim();
}

function isAddress(value: string): boolean {
  return ADDRESS_PATTERN.test(addressOf(value));
}

function parsePort(raw: string | undefined, fallback: number, label: string) {
  if (!raw) return fallback;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new EmailConfigurationError(`${label} must be a valid TCP port.`);
  }
  return port;
}

function parseBoolean(raw: string | undefined, fallback: boolean): boolean {
  if (!raw) return fallback;
  return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
}

/**
 * SMTP needs raw sockets, so a Worker cannot use it: every other transport
 * leaves over HTTPS. An explicit EMAIL_TRANSPORT wins, otherwise a GitHub
 * dispatch, then a Brevo key, then a relay URL, and SMTP when none is set.
 */
function resolveTransport(env: Record<string, string | undefined>): EmailTransport {
  const explicit = env.EMAIL_TRANSPORT?.trim().toLowerCase();
  if (
    explicit === "smtp" ||
    explicit === "webhook" ||
    explicit === "brevo" ||
    explicit === "github"
  ) {
    return explicit;
  }
  if (explicit) {
    throw new EmailConfigurationError(
      "EMAIL_TRANSPORT must be 'smtp', 'webhook', 'brevo' or 'github'.",
    );
  }
  if (env.GITHUB_DISPATCH_TOKEN?.trim()) return "github";
  if (env.BREVO_API_KEY?.trim()) return "brevo";
  return env.EMAIL_WEBHOOK_URL?.trim() ? "webhook" : "smtp";
}

function sharedConfig(env: Record<string, string | undefined>) {
  const admissionsEmail =
    env.ADMISSIONS_EMAIL?.trim() || INSTITUTION.admissionsEmail;
  if (!isAddress(admissionsEmail)) {
    throw new EmailConfigurationError("ADMISSIONS_EMAIL must be an email address.");
  }
  return {
    admissionsEmail,
    logoUrl: env.EMAIL_LOGO_URL?.trim() || DEFAULT_EMAIL_LOGO_URL,
  };
}

function smtpConfig(
  env: Record<string, string | undefined>,
): EmailConfig {
  const user = env.SMTP_USER?.trim() ?? "";
  const password = (env.SMTP_APP_PASSWORD ?? env.SMTP_PASSWORD ?? "").trim();

  if (!user) {
    throw new EmailConfigurationError(
      "SMTP_USER is not configured on the server.",
    );
  }
  if (!isAddress(user)) {
    throw new EmailConfigurationError("SMTP_USER must be an email address.");
  }
  if (!password) {
    throw new EmailConfigurationError(
      "SMTP_APP_PASSWORD is not configured on the server.",
    );
  }

  const preset = SMTP_PRESETS[addressOf(user).split("@")[1]?.toLowerCase() ?? ""];
  const host = env.SMTP_HOST?.trim() || preset?.host;
  if (!host) {
    throw new EmailConfigurationError(
      "SMTP_HOST is not configured on the server.",
    );
  }

  const port = parsePort(env.SMTP_PORT, preset?.port ?? 465, "SMTP_PORT");
  const secure = parseBoolean(env.SMTP_SECURE, port === 465);

  const from = env.EMAIL_FROM?.trim() || `AIMS Admissions <${user}>`;
  if (!isAddress(from)) {
    throw new EmailConfigurationError(
      "EMAIL_FROM must be a plain address or 'Name <address>'.",
    );
  }

  return {
    transport: "smtp",
    smtp: { host, port, secure, user, password },
    webhook: null,
    brevo: null,
    github: null,
    from,
    ...sharedConfig(env),
  };
}

function webhookConfig(
  env: Record<string, string | undefined>,
): EmailConfig {
  const url = env.EMAIL_WEBHOOK_URL?.trim() ?? "";
  // Student names and contact details travel over this link.
  if (!/^https:\/\//i.test(url)) {
    throw new EmailConfigurationError(
      "EMAIL_WEBHOOK_URL must be an https:// URL.",
    );
  }

  // The relay sends from its own mailbox, so this is only the display name.
  const from = env.EMAIL_FROM?.trim() || "AIMS Admissions";

  return {
    transport: "webhook",
    smtp: null,
    webhook: { url, token: env.EMAIL_WEBHOOK_SECRET?.trim() ?? "" },
    brevo: null,
    github: null,
    from,
    ...sharedConfig(env),
  };
}

function brevoConfig(env: Record<string, string | undefined>): EmailConfig {
  const apiKey = env.BREVO_API_KEY?.trim() ?? "";
  if (!apiKey) {
    throw new EmailConfigurationError(
      "BREVO_API_KEY is not configured on the server.",
    );
  }

  // Brevo sends from an address verified in the account, so this must be a
  // plain address rather than a display name.
  const from = env.EMAIL_FROM?.trim() || env.SMTP_USER?.trim() || "";
  if (!from || !isAddress(from)) {
    throw new EmailConfigurationError(
      "EMAIL_FROM must be the email address you verified with Brevo.",
    );
  }

  return {
    transport: "brevo",
    smtp: null,
    webhook: null,
    brevo: { apiKey },
    github: null,
    from,
    ...sharedConfig(env),
  };
}

function githubConfig(
  env: Record<string, string | undefined>,
): EmailConfig {
  const repo = env.GITHUB_DISPATCH_REPO?.trim() ?? "";
  if (!REPO_PATTERN.test(repo)) {
    throw new EmailConfigurationError(
      "GITHUB_DISPATCH_REPO must be 'owner/repository'.",
    );
  }

  const token = env.GITHUB_DISPATCH_TOKEN?.trim() ?? "";
  if (!token) {
    throw new EmailConfigurationError(
      "GITHUB_DISPATCH_TOKEN is not configured on the server.",
    );
  }

  const workflow = env.GITHUB_DISPATCH_WORKFLOW?.trim() || "send-enquiry-mail.yml";
  if (!WORKFLOW_PATTERN.test(workflow)) {
    throw new EmailConfigurationError(
      "GITHUB_DISPATCH_WORKFLOW must be a workflow file name.",
    );
  }

  const ref = env.GITHUB_DISPATCH_REF?.trim() || "main";
  if (!REF_PATTERN.test(ref)) {
    throw new EmailConfigurationError(
      "GITHUB_DISPATCH_REF must be a branch or tag name.",
    );
  }

  // Validated here rather than at dispatch time: without it the runner could
  // never open the payload, and every enquiry would be lost silently.
  const payloadKey = env.MAIL_PAYLOAD_KEY?.trim() ?? "";
  try {
    assertMailPayloadKey(payloadKey);
  } catch (error) {
    throw new EmailConfigurationError(
      error instanceof Error
        ? error.message
        : "MAIL_PAYLOAD_KEY is not configured on the server.",
    );
  }

  return {
    transport: "github",
    smtp: null,
    webhook: null,
    brevo: null,
    github: { repo, workflow, ref, token, payloadKey },
    // Unused: the runner decides the sender, from its own environment.
    from: env.EMAIL_FROM?.trim() || "AIMS Admissions",
    ...sharedConfig(env),
  };
}

/**
 * Reads mail settings from the server environment. Callers must surface a
 * configuration failure as "service unavailable" rather than pretending the
 * enquiry was accepted.
 */
export function getEmailConfig(
  env: Record<string, string | undefined> = process.env,
): EmailConfig {
  const transport = resolveTransport(env);
  if (transport === "github") return githubConfig(env);
  if (transport === "brevo") return brevoConfig(env);
  return transport === "webhook" ? webhookConfig(env) : smtpConfig(env);
}
