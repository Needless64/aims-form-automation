import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  EmailProviderError,
  createBrevoProvider,
  createEmailProvider,
  createSmtpProvider,
  createWebhookProvider,
  resetSmtpTransports,
  type EmailMessage,
  type MailTransport,
} from "@/lib/email/provider";
import type { EmailConfig } from "@/lib/email/config";

const { sendMailMock, createTransportMock } = vi.hoisted(() => {
  const sendMail = vi.fn();
  return {
    sendMailMock: sendMail,
    createTransportMock: vi.fn((_options?: Record<string, unknown>) => ({
      sendMail,
    })),
  };
});

vi.mock("nodemailer", () => ({
  default: { createTransport: createTransportMock },
}));

const settings = {
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  user: "admissions@example.com",
  password: "app-password-value",
};

const message: EmailMessage = {
  from: "AIMS Admissions <admissions@example.com>",
  to: "student@example.com",
  subject: "Subject",
  html: "<p>Hello</p>",
  text: "Hello",
  replyTo: "student@example.com",
  idempotencyKey: "aims-student-AIMS-26-ABCDEF",
};

beforeEach(() => {
  sendMailMock.mockReset();
  sendMailMock.mockResolvedValue({ messageId: "<abc@example.com>" });
  createTransportMock.mockClear();
  resetSmtpTransports();
});

describe("SMTP provider", () => {
  it("sends the message through the transport and returns its message id", async () => {
    const provider = createSmtpProvider({
      ...settings,
      transport: { sendMail: sendMailMock } as MailTransport,
    });

    await expect(provider.send(message)).resolves.toEqual({
      id: "<abc@example.com>",
    });

    expect(sendMailMock).toHaveBeenCalledTimes(1);
    expect(sendMailMock.mock.calls[0][0]).toEqual({
      from: message.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      replyTo: message.replyTo,
      messageId: "aims-student-AIMS-26-ABCDEF@example.com",
    });
  });

  it("omits Reply-To when the message has none", async () => {
    const provider = createSmtpProvider({
      ...settings,
      transport: { sendMail: sendMailMock } as MailTransport,
    });
    await provider.send({ ...message, replyTo: undefined });

    const mail = sendMailMock.mock.calls[0][0] as Record<string, unknown>;
    expect(mail.replyTo).toBeUndefined();
    expect(Object.keys(mail)).not.toContain("replyTo");
  });

  it("connects with the configured host, port, TLS mode and app password", async () => {
    await createSmtpProvider(settings).send(message);

    expect(createTransportMock).toHaveBeenCalledTimes(1);
    expect(createTransportMock.mock.calls[0][0]).toMatchObject({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: "admissions@example.com", pass: "app-password-value" },
    });
  });

  it("reuses one transport across sends", async () => {
    const provider = createSmtpProvider(settings);
    await provider.send(message);
    await provider.send(message);
    expect(createTransportMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    [{ code: "EAUTH" }, "provider_auth_failed"],
    [{ code: "EENVELOPE" }, "provider_rejected"],
    [{ code: "ETIMEDOUT" }, "provider_timeout"],
    [{ code: "ECONNECTION" }, "provider_unreachable"],
    [{ code: "ENOTFOUND" }, "provider_unreachable"],
    [{ responseCode: 550 }, "provider_rejected"],
    [{ responseCode: 451 }, "provider_unavailable"],
    [{ code: "EUNKNOWN" }, "provider_error"],
  ])("maps %j to %s", async (failure, code) => {
    sendMailMock.mockRejectedValueOnce(Object.assign(new Error("smtp"), failure));
    const provider = createSmtpProvider({
      ...settings,
      transport: { sendMail: sendMailMock } as MailTransport,
    });

    await expect(provider.send(message)).rejects.toMatchObject({ code });
  });

  it("does not leak addresses from the SMTP error message", async () => {
    sendMailMock.mockRejectedValueOnce(
      new Error("550 student@example.com mailbox unavailable"),
    );
    const provider = createSmtpProvider({
      ...settings,
      transport: { sendMail: sendMailMock } as MailTransport,
    });

    try {
      await provider.send(message);
      throw new Error("expected rejection");
    } catch (error) {
      expect(error).toBeInstanceOf(EmailProviderError);
      expect((error as EmailProviderError).message).not.toContain(
        "student@example.com",
      );
      expect((error as EmailProviderError).message).not.toContain(
        "app-password-value",
      );
    }
  });
});

describe("relay (webhook) provider", () => {
  const relay = {
    url: "https://script.google.com/macros/s/AKfycbx/exec",
    token: "relay-secret",
  };

  function relayFetch(outcome: Response | Error) {
    const fetcher = vi.fn<typeof fetch>();
    if (outcome instanceof Response) {
      fetcher.mockResolvedValue(outcome);
    } else {
      fetcher.mockRejectedValue(outcome);
    }
    return fetcher;
  }

  it("posts the prepared message and returns the relay's id", async () => {
    const fetcher = relayFetch(
      new Response(JSON.stringify({ ok: true, id: "mail-1" })),
    );
    const provider = createWebhookProvider({ ...relay, fetcher });

    await expect(provider.send(message)).resolves.toEqual({ id: "mail-1" });

    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe(relay.url);
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({
      token: "relay-secret",
      mail: {
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        name: "AIMS Admissions",
        replyTo: message.replyTo,
      },
    });
  });

  it("omits Reply-To when the message has none", async () => {
    const fetcher = relayFetch(new Response(JSON.stringify({ ok: true })));
    await createWebhookProvider({ ...relay, fetcher }).send({
      ...message,
      replyTo: undefined,
    });

    const mail = JSON.parse(String(fetcher.mock.calls[0][1]?.body)).mail;
    expect(Object.keys(mail)).not.toContain("replyTo");
  });

  it("sends no display name when the sender is a bare address", async () => {
    const fetcher = relayFetch(new Response(JSON.stringify({ ok: true })));
    await createWebhookProvider({ ...relay, fetcher }).send({
      ...message,
      from: "admissions@example.com",
    });

    const mail = JSON.parse(String(fetcher.mock.calls[0][1]?.body)).mail;
    expect(mail.name).toBe("");
  });

  it.each([
    [
      new Response(JSON.stringify({ ok: false, error: "unauthorised" })),
      "provider_auth_failed",
    ],
    [new Response("denied", { status: 403 }), "provider_auth_failed"],
    [new Response("boom", { status: 500 }), "provider_unavailable"],
    [new Response("bad", { status: 400 }), "provider_rejected"],
    [
      new Response(JSON.stringify({ ok: false, error: "quota exceeded" })),
      "provider_rejected",
    ],
    [
      Object.assign(new Error("aborted"), { name: "TimeoutError" }),
      "provider_timeout",
    ],
    [new TypeError("fetch failed"), "provider_unreachable"],
  ])("maps %s to %s", async (outcome, code) => {
    const provider = createWebhookProvider({
      ...relay,
      fetcher: relayFetch(outcome as Response | Error),
    });

    await expect(provider.send(message)).rejects.toMatchObject({ code });
  });

  it("is chosen by config when the relay is configured", async () => {
    const fetcher = relayFetch(new Response(JSON.stringify({ ok: true })));
    vi.stubGlobal("fetch", fetcher);

    const config: EmailConfig = {
      transport: "webhook",
      smtp: null,
      webhook: relay,
      brevo: null,
      github: null,
      from: "AIMS Admissions",
      admissionsEmail: "admissions@aims.ac.in",
      logoUrl: "https://example.test/logo.png",
    };

    await expect(createEmailProvider(config).send(message)).resolves.toEqual({
      id: "",
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("refuses to build a transport whose settings are missing", () => {
    const base: EmailConfig = {
      transport: "webhook",
      smtp: null,
      webhook: null,
      brevo: null,
      github: null,
      from: "AIMS Admissions",
      admissionsEmail: "admissions@aims.ac.in",
      logoUrl: "https://example.test/logo.png",
    };

    expect(() => createEmailProvider(base)).toThrow(/relay URL/);
    expect(() =>
      createEmailProvider({ ...base, transport: "smtp" }),
    ).toThrow(/SMTP settings/);
    expect(() =>
      createEmailProvider({ ...base, transport: "brevo" }),
    ).toThrow(/API key/);
  });
});

describe("Brevo provider", () => {
  function brevoFetch(outcome: Response | Error) {
    const fetcher = vi.fn<typeof fetch>();
    if (outcome instanceof Response) {
      fetcher.mockResolvedValue(outcome);
    } else {
      fetcher.mockRejectedValue(outcome);
    }
    return fetcher;
  }

  it("posts the message to the Brevo endpoint and returns its message id", async () => {
    const fetcher = brevoFetch(
      new Response(JSON.stringify({ messageId: "<brevo-1@example.com>" })),
    );
    const provider = createBrevoProvider({
      apiKey: "brevo-key",
      fetcher,
    });

    await expect(provider.send(message)).resolves.toEqual({
      id: "<brevo-1@example.com>",
    });

    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    expect((init?.headers as Record<string, string>)["api-key"]).toBe(
      "brevo-key",
    );
    expect(JSON.parse(String(init?.body))).toEqual({
      sender: { email: "admissions@example.com", name: "AIMS Admissions" },
      to: [{ email: "student@example.com" }],
      subject: message.subject,
      htmlContent: message.html,
      textContent: message.text,
      replyTo: { email: "student@example.com" },
      headers: { IdempotencyKey: message.idempotencyKey },
    });
  });

  it("omits Reply-To when the message has none", async () => {
    const fetcher = brevoFetch(new Response(JSON.stringify({ messageId: "x" })));
    await createBrevoProvider({ apiKey: "k", fetcher }).send({
      ...message,
      replyTo: undefined,
    });

    const body = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
    expect(Object.keys(body)).not.toContain("replyTo");
  });

  it.each([
    [new Response("denied", { status: 401 }), "provider_auth_failed"],
    [new Response("denied", { status: 403 }), "provider_auth_failed"],
    [new Response("slow down", { status: 429 }), "provider_unavailable"],
    [new Response("boom", { status: 502 }), "provider_unavailable"],
    [new Response("bad sender", { status: 400 }), "provider_rejected"],
    [
      Object.assign(new Error("aborted"), { name: "TimeoutError" }),
      "provider_timeout",
    ],
    [new TypeError("fetch failed"), "provider_unreachable"],
  ])("maps %s to %s", async (outcome, code) => {
    const provider = createBrevoProvider({
      apiKey: "k",
      fetcher: brevoFetch(outcome as Response | Error),
    });

    await expect(provider.send(message)).rejects.toMatchObject({ code });
  });
});
