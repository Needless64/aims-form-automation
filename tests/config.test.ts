import { describe, expect, it } from "vitest";
import { EmailConfigurationError, getEmailConfig } from "@/lib/email/config";
import { generateMailPayloadKey } from "@/lib/mail-payload";

const gmail = {
  SMTP_USER: "aims.admissions@gmail.com",
  SMTP_APP_PASSWORD: "abcd efgh ijkl mnop",
};

describe("email configuration", () => {
  it("derives Gmail SMTP settings and a default sender from the mailbox", () => {
    const config = getEmailConfig(gmail);

    expect(config.smtp).toEqual({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      user: "aims.admissions@gmail.com",
      password: "abcd efgh ijkl mnop",
    });
    expect(config.from).toBe(
      "AIMS Admissions <aims.admissions@gmail.com>",
    );
  });

  it("uses STARTTLS by default on port 587", () => {
    const config = getEmailConfig({
      ...gmail,
      SMTP_HOST: "mail.aims-test.example",
      SMTP_PORT: "587",
      SMTP_USER: "admissions@aims-test.example",
    });

    expect(config.smtp?.port).toBe(587);
    expect(config.smtp?.secure).toBe(false);
  });

  it("honours an explicit sender and admissions inbox", () => {
    const config = getEmailConfig({
      ...gmail,
      EMAIL_FROM: "AIMS Admissions <admissions@aims.ac.in>",
      ADMISSIONS_EMAIL: "admissions.team@aims.ac.in",
    });

    expect(config.from).toBe("AIMS Admissions <admissions@aims.ac.in>");
    expect(config.admissionsEmail).toBe("admissions.team@aims.ac.in");
  });

  it("requires a mailbox and an app password", () => {
    expect(() => getEmailConfig({})).toThrow(EmailConfigurationError);
    expect(() => getEmailConfig({ SMTP_USER: gmail.SMTP_USER })).toThrow(
      /SMTP_APP_PASSWORD/,
    );
  });

  it("requires SMTP_HOST for a domain it has no preset for", () => {
    expect(() =>
      getEmailConfig({
        ...gmail,
        SMTP_USER: "admissions@aims-test.example",
      }),
    ).toThrow(/SMTP_HOST/);
  });

  it("rejects malformed addresses", () => {
    expect(() =>
      getEmailConfig({ ...gmail, EMAIL_FROM: "not an address" }),
    ).toThrow(/EMAIL_FROM/);
    expect(() =>
      getEmailConfig({ ...gmail, ADMISSIONS_EMAIL: "nope" }),
    ).toThrow(/ADMISSIONS_EMAIL/);
  });

  it("rejects an invalid port", () => {
    expect(() => getEmailConfig({ ...gmail, SMTP_PORT: "70000" })).toThrow(
      /SMTP_PORT/,
    );
  });
});

describe("relay configuration", () => {
  const relay = {
    EMAIL_WEBHOOK_URL: "https://script.google.com/macros/s/AKfycbx/exec",
    EMAIL_WEBHOOK_SECRET: "relay-secret",
  };

  it("selects the relay when a webhook URL is present, without SMTP credentials", () => {
    const config = getEmailConfig(relay);

    expect(config.transport).toBe("webhook");
    expect(config.webhook).toEqual({
      url: relay.EMAIL_WEBHOOK_URL,
      token: "relay-secret",
    });
    expect(config.smtp).toBeNull();
    expect(config.from).toBe("AIMS Admissions");
    expect(config.admissionsEmail).toBe("admissions@aims.ac.in");
  });

  it("lets EMAIL_TRANSPORT override the inferred transport", () => {
    expect(
      getEmailConfig({ ...relay, ...gmail, EMAIL_TRANSPORT: "smtp" }).transport,
    ).toBe("smtp");
    expect(
      getEmailConfig({ ...gmail, ...relay, EMAIL_TRANSPORT: "webhook" })
        .transport,
    ).toBe("webhook");
  });

  it("rejects an unknown transport and a plain-http relay", () => {
    expect(() =>
      getEmailConfig({ ...relay, EMAIL_TRANSPORT: "carrier-pigeon" }),
    ).toThrow(/EMAIL_TRANSPORT/);
    expect(() =>
      getEmailConfig({ EMAIL_WEBHOOK_URL: "http://example.test/relay" }),
    ).toThrow(/https/);
  });
});

describe("Brevo configuration", () => {
  const brevo = {
    BREVO_API_KEY: "brevo-key",
    EMAIL_FROM: "AIMS Admissions <aims.admissions@gmail.com>",
  };

  it("selects Brevo when an API key is present", () => {
    const config = getEmailConfig(brevo);

    expect(config.transport).toBe("brevo");
    expect(config.brevo).toEqual({ apiKey: "brevo-key" });
    expect(config.from).toBe("AIMS Admissions <aims.admissions@gmail.com>");
    expect(config.smtp).toBeNull();
    expect(config.webhook).toBeNull();
  });

  it("prefers Brevo over the relay when both are configured", () => {
    expect(
      getEmailConfig({
        ...brevo,
        EMAIL_WEBHOOK_URL: "https://script.google.com/macros/s/AKfycbx/exec",
      }).transport,
    ).toBe("brevo");
  });

  it("requires a verified sender address, not a display name", () => {
    expect(() =>
      getEmailConfig({ BREVO_API_KEY: "k", EMAIL_FROM: "AIMS Admissions" }),
    ).toThrow(/EMAIL_FROM/);
  });

  it("falls back to SMTP_USER for the sender when EMAIL_FROM is unset", () => {
    expect(
      getEmailConfig({ BREVO_API_KEY: "k", SMTP_USER: "aims@gmail.com" }).from,
    ).toBe("aims@gmail.com");
  });
});

describe("GitHub dispatch configuration", () => {
  const payloadKey = generateMailPayloadKey();
  const github = {
    GITHUB_DISPATCH_REPO: "Needless64/aims-form-automation",
    GITHUB_DISPATCH_TOKEN: "github_pat_test",
    MAIL_PAYLOAD_KEY: payloadKey,
  };

  it("selects the dispatch transport when a token is present", () => {
    const config = getEmailConfig(github);

    expect(config.transport).toBe("github");
    expect(config.github).toEqual({
      repo: github.GITHUB_DISPATCH_REPO,
      workflow: "send-enquiry-mail.yml",
      ref: "main",
      token: github.GITHUB_DISPATCH_TOKEN,
      payloadKey,
    });
    expect(config.smtp).toBeNull();
    expect(config.webhook).toBeNull();
    expect(config.brevo).toBeNull();
  });

  it("prefers the runner over Brevo and the relay when all are configured", () => {
    expect(
      getEmailConfig({
        ...github,
        BREVO_API_KEY: "brevo-key",
        EMAIL_WEBHOOK_URL: "https://script.google.com/macros/s/AKfycbx/exec",
      }).transport,
    ).toBe("github");
  });

  it("honours an explicit workflow and ref", () => {
    const config = getEmailConfig({
      ...github,
      GITHUB_DISPATCH_WORKFLOW: "mail.yml",
      GITHUB_DISPATCH_REF: "release",
    });

    expect(config.github?.workflow).toBe("mail.yml");
    expect(config.github?.ref).toBe("release");
  });

  it("requires owner/name, and rejects a workflow path or a ref with spaces", () => {
    expect(() =>
      getEmailConfig({ ...github, GITHUB_DISPATCH_REPO: "aims-form-automation" }),
    ).toThrow(/owner\/repository/);
    expect(() =>
      getEmailConfig({ ...github, GITHUB_DISPATCH_WORKFLOW: ".github/mail.yml" }),
    ).toThrow(/workflow file name/);
    expect(() =>
      getEmailConfig({ ...github, GITHUB_DISPATCH_REF: "my branch" }),
    ).toThrow(/branch or tag/);
  });

  it("forces a valid payload key, so no enquiry can be sealed unusably", () => {
    expect(() =>
      getEmailConfig({ ...github, MAIL_PAYLOAD_KEY: "c2hvcnQ=" }),
    ).toThrow(/32 bytes/);
    expect(() =>
      getEmailConfig({ ...github, MAIL_PAYLOAD_KEY: "not base64 !!!" }),
    ).toThrow(/base64/);
    expect(() => {
      const { MAIL_PAYLOAD_KEY: _unused, ...withoutKey } = github;
      getEmailConfig(withoutKey);
    }).toThrow(/MAIL_PAYLOAD_KEY/);
  });

  it("rejects the github transport when its own settings are missing", () => {
    expect(() =>
      getEmailConfig({
        GITHUB_DISPATCH_TOKEN: "github_pat_test",
        MAIL_PAYLOAD_KEY: payloadKey,
      }),
    ).toThrow(/GITHUB_DISPATCH_REPO/);
    expect(() =>
      getEmailConfig({ ...github, GITHUB_DISPATCH_TOKEN: "" , EMAIL_TRANSPORT: "github" }),
    ).toThrow(/GITHUB_DISPATCH_TOKEN/);
  });
});
