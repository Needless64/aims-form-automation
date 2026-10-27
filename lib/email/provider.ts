import type { EmailConfig } from "@/lib/email/config";

export interface EmailMessage {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  idempotencyKey: string;
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<{ id: string }>;
}

export class EmailProviderError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "EmailProviderError";
    this.code = code;
  }
}

export interface SmtpSettings {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
}

export interface WebhookSettings {
  url: string;
  token: string;
}

export interface BrevoSettings {
  apiKey: string;
}

/** The subset of a Nodemailer transport this adapter relies on. */
export interface MailTransport {
  sendMail(mail: {
    from: string;
    to: string;
    subject: string;
    html: string;
    text: string;
    replyTo?: string;
    messageId?: string;
  }): Promise<{ messageId?: string }>;
}

interface SmtpProviderOptions extends SmtpSettings {
  transport?: MailTransport;
  timeoutMs?: number;
}

const transports = new Map<string, MailTransport>();

function transportKey(settings: SmtpSettings): string {
  return [
    settings.host,
    settings.port,
    settings.secure ? "tls" : "plain",
    settings.user,
    settings.password,
  ].join("|");
}

/**
 * Nodemailer is imported only when an SMTP transport is actually built. It
 * needs node:net and node:tls, which the Workers runtime does not provide, so
 * the webhook transport must never drag it into the bundle's hot path.
 */
async function getTransport(
  settings: SmtpSettings,
  timeoutMs: number,
): Promise<MailTransport> {
  const key = transportKey(settings);
  const existing = transports.get(key);
  if (existing) return existing;

  const { default: nodemailer } = await import("nodemailer");
  const transport: MailTransport = nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    auth: { user: settings.user, pass: settings.password },
    connectionTimeout: timeoutMs,
    greetingTimeout: timeoutMs,
    socketTimeout: timeoutMs,
  });
  transports.set(key, transport);
  return transport;
}

/** Only used by tests to avoid keeping stale transports between cases. */
export function resetSmtpTransports(): void {
  transports.clear();
}

function mapSmtpError(error: unknown): EmailProviderError {
  const candidate = error as {
    code?: unknown;
    responseCode?: unknown;
    name?: unknown;
  };
  const code = typeof candidate?.code === "string" ? candidate.code : "";
  const responseCode =
    typeof candidate?.responseCode === "number" ? candidate.responseCode : 0;
  const name = typeof candidate?.name === "string" ? candidate.name : "";

  if (code === "EAUTH" || responseCode === 535) {
    return new EmailProviderError(
      "provider_auth_failed",
      "The mail server rejected the SMTP credentials. Check the app password.",
    );
  }
  if (code === "ETIMEDOUT" || code === "ETIMEOUT" || name === "TimeoutError") {
    return new EmailProviderError(
      "provider_timeout",
      "The mail server did not respond in time.",
    );
  }
  if (code === "EENVELOPE" || code === "EMESSAGE" || code === "EMAXSIZE") {
    return new EmailProviderError(
      "provider_rejected",
      "The mail server rejected the sender or recipient address.",
    );
  }
  if (
    code === "ECONNECTION" ||
    code === "ECONNREFUSED" ||
    code === "ESOCKET" ||
    code === "ENOTFOUND" ||
    code === "EDNS"
  ) {
    return new EmailProviderError(
      "provider_unreachable",
      "The mail server could not be reached.",
    );
  }
  if (responseCode >= 500) {
    return new EmailProviderError(
      "provider_rejected",
      "The mail server rejected the message.",
    );
  }
  if (responseCode >= 400) {
    return new EmailProviderError(
      "provider_unavailable",
      "The mail server is temporarily unable to accept the message.",
    );
  }
  // Never surface the original message: SMTP errors can echo addresses.
  return new EmailProviderError(
    "provider_error",
    "The message could not be sent.",
  );
}

function messageId(idempotencyKey: string, from: string): string {
  const address = from.match(/<([^>]+)>/)?.[1] ?? from;
  const domain = address.split("@")[1]?.trim() || "localhost";
  const local = idempotencyKey.replace(/[^A-Za-z0-9._-]/g, "-");
  return `${local}@${domain}`;
}

/**
 * SMTP adapter for an ordinary mailbox authenticated with an app password
 * (Gmail, Microsoft 365, Zoho, or a hosted mail server). Uses STARTTLS or
 * implicit TLS depending on the port; the password is never exposed to the
 * client or logged. Unusable on Workers, where node:net is unavailable.
 */
export function createSmtpProvider({
  transport,
  timeoutMs = 15_000,
  ...settings
}: SmtpProviderOptions): EmailProvider {
  return {
    async send(message) {
      const mailer = transport ?? (await getTransport(settings, timeoutMs));
      try {
        const result = await mailer.sendMail({
          from: message.from,
          to: message.to,
          subject: message.subject,
          html: message.html,
          text: message.text,
          ...(message.replyTo ? { replyTo: message.replyTo } : {}),
          messageId: messageId(message.idempotencyKey, message.from),
        });
        return { id: result?.messageId ?? "" };
      } catch (error) {
        throw mapSmtpError(error);
      }
    },
  };
}

interface WebhookProviderOptions extends WebhookSettings {
  timeoutMs?: number;
  fetcher?: typeof fetch;
}

const DEFAULT_WEBHOOK_TIMEOUT_MS = 15_000;

/** Display name out of "Name <address>", empty when the sender is a bare address. */
function displayName(from: string): string {
  const named = from.match(/^(.*?)<[^>]+>\s*$/)?.[1]?.trim();
  if (named) return named;
  return from.includes("@") ? "" : from.trim();
}

function mapWebhookError(error: unknown): EmailProviderError {
  const name = (error as { name?: unknown })?.name;
  if (name === "TimeoutError" || name === "AbortError") {
    return new EmailProviderError(
      "provider_timeout",
      "The mail relay did not respond in time.",
    );
  }
  return new EmailProviderError(
    "provider_unreachable",
    "The mail relay could not be reached.",
  );
}

/**
 * HTTPS adapter for environments without raw sockets — notably Cloudflare
 * Workers, where nodemailer cannot run. The relay is a small script on our own
 * mail account; it receives one prepared message and sends it, so no student
 * data goes to a third-party mail vendor.
 */
export function createWebhookProvider({
  url,
  token,
  timeoutMs = DEFAULT_WEBHOOK_TIMEOUT_MS,
  fetcher = fetch,
}: WebhookProviderOptions): EmailProvider {
  return {
    async send(message) {
      let response: Response;
      try {
        response = await fetcher(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token,
            mail: {
              to: message.to,
              subject: message.subject,
              html: message.html,
              text: message.text,
              name: displayName(message.from),
              ...(message.replyTo ? { replyTo: message.replyTo } : {}),
            },
          }),
          signal: AbortSignal.timeout(timeoutMs),
          cache: "no-store",
        });
      } catch (error) {
        throw mapWebhookError(error);
      }

      if (response.status === 401 || response.status === 403) {
        throw new EmailProviderError(
          "provider_auth_failed",
          "The mail relay rejected the shared secret.",
        );
      }
      if (!response.ok) {
        throw new EmailProviderError(
          response.status >= 500 ? "provider_unavailable" : "provider_rejected",
          "The mail relay refused the message.",
        );
      }

      const body = (await response.json().catch(() => null)) as
        | { ok?: unknown; id?: unknown; error?: unknown }
        | null;

      if (body?.ok !== true) {
        throw new EmailProviderError(
          body?.error === "unauthorised"
            ? "provider_auth_failed"
            : "provider_rejected",
          "The mail relay refused the message.",
        );
      }

      return { id: typeof body.id === "string" ? body.id : "" };
    },
  };
}

interface BrevoProviderOptions extends BrevoSettings {
  timeoutMs?: number;
  fetcher?: typeof fetch;
}

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";
const DEFAULT_BREVO_TIMEOUT_MS = 15_000;

/** "Name <address>" split into the sender object Brevo expects. */
function senderParts(from: string): { email: string; name?: string } {
  const address = from.match(/<([^>]+)>/)?.[1]?.trim();
  if (!address) return { email: from.trim() };
  const name = from.slice(0, from.indexOf("<")).trim();
  return name ? { email: address, name } : { email: address };
}

/**
 * Brevo (formerly Sendinblue) over HTTPS. Brevo verifies a single sender
 * address rather than requiring a domain, which is what makes it usable here:
 * the deployment has no domain of its own. The sender in EMAIL_FROM must be the
 * address verified in the Brevo account.
 */
export function createBrevoProvider({
  apiKey,
  timeoutMs = DEFAULT_BREVO_TIMEOUT_MS,
  fetcher = fetch,
}: BrevoProviderOptions): EmailProvider {
  return {
    async send(message) {
      let response: Response;
      try {
        response = await fetcher(BREVO_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "api-key": apiKey,
          },
          body: JSON.stringify({
            sender: senderParts(message.from),
            to: [{ email: message.to }],
            subject: message.subject,
            htmlContent: message.html,
            textContent: message.text,
            ...(message.replyTo ? { replyTo: { email: message.replyTo } } : {}),
            // Keeps a retried leg from being delivered twice.
            headers: { IdempotencyKey: message.idempotencyKey },
          }),
          signal: AbortSignal.timeout(timeoutMs),
          cache: "no-store",
        });
      } catch (error) {
        throw mapWebhookError(error);
      }

      if (response.status === 401 || response.status === 403) {
        throw new EmailProviderError(
          "provider_auth_failed",
          "Brevo rejected the API key.",
        );
      }
      if (response.status === 429 || response.status >= 500) {
        throw new EmailProviderError(
          "provider_unavailable",
          "Brevo is temporarily unable to accept the message.",
        );
      }
      if (!response.ok) {
        throw new EmailProviderError(
          "provider_rejected",
          "Brevo rejected the sender or recipient address.",
        );
      }

      const body = (await response.json().catch(() => null)) as
        | { messageId?: unknown }
        | null;
      return { id: typeof body?.messageId === "string" ? body.messageId : "" };
    },
  };
}

/**
 * Builds the provider from validated server configuration: SMTP where sockets
 * exist, otherwise an HTTPS API — Brevo, or our own relay script.
 */
export function createEmailProvider(config: EmailConfig): EmailProvider {
  if (config.transport === "brevo") {
    if (!config.brevo) {
      throw new Error("Brevo transport selected without an API key.");
    }
    return createBrevoProvider(config.brevo);
  }
  if (config.transport === "webhook") {
    if (!config.webhook) {
      throw new Error("Webhook transport selected without a relay URL.");
    }
    return createWebhookProvider(config.webhook);
  }
  if (!config.smtp) {
    throw new Error("SMTP transport selected without SMTP settings.");
  }
  return createSmtpProvider(config.smtp);
}
