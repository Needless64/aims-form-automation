import { describe, expect, it, vi } from "vitest";
import type { EmailMessage, EmailProvider } from "@/lib/email/provider";
import { EmailProviderError } from "@/lib/email/provider";
import {
  deliverEnquiryEmails,
  sendAdmissionsNotification,
  sendStudentConfirmation,
} from "@/lib/email/service";
import { validEnquiry } from "./fixtures";

const referenceId = "AIMS-26-AB7K9Q";
const submittedAt = new Date("2026-10-27T13:12:00Z");
const input = { enquiry: validEnquiry, referenceId, submittedAt };

function createProvider(
  implementation: (message: EmailMessage) => Promise<{ id: string }>,
): EmailProvider & { send: ReturnType<typeof vi.fn> } {
  return { send: vi.fn(implementation) };
}

function context(provider: EmailProvider) {
  return {
    provider,
    from: "AIMS Admissions <admissions@mail.aims-test.example>",
    admissionsEmail: "admissions@aims.ac.in",
    logoUrl: "https://example.com/logo.png",
  };
}

describe("student confirmation delivery", () => {
  it("sends only to the validated student address with the right subject", async () => {
    const provider = createProvider(async () => ({ id: "student_1" }));
    const state = await sendStudentConfirmation(input, context(provider));

    expect(state).toEqual({ status: "accepted", providerId: "student_1" });
    expect(provider.send).toHaveBeenCalledTimes(1);

    const message = provider.send.mock.calls[0][0] as EmailMessage;
    expect(message.to).toBe("ananya.rao@example.com");
    expect(message.subject).toBe(
      "Your AIMS Admissions Enquiry Has Been Received — Ananya Rao",
    );
    expect(message.replyTo).toBeUndefined();
    expect(message.idempotencyKey).toBe(`aims-student-${referenceId}`);
    expect(message.html).toContain(referenceId);
    expect(message.text).toContain(referenceId);
  });

  it("reports a provider failure instead of throwing", async () => {
    const provider = createProvider(async () => {
      throw new EmailProviderError("provider_rejected", "Rejected");
    });
    const state = await sendStudentConfirmation(input, context(provider));
    expect(state).toEqual({
      status: "failed",
      errorCode: "provider_rejected",
    });
  });
});

describe("admissions notification delivery", () => {
  it("always sends to the server-controlled admissions inbox with Reply-To", async () => {
    const provider = createProvider(async () => ({ id: "admin_1" }));
    const state = await sendAdmissionsNotification(input, context(provider));

    expect(state).toEqual({ status: "accepted", providerId: "admin_1" });
    const message = provider.send.mock.calls[0][0] as EmailMessage;
    expect(message.to).toBe("admissions@aims.ac.in");
    expect(message.replyTo).toBe("ananya.rao@example.com");
    expect(message.subject).toBe(
      `New AIMS Admissions Enquiry — Ananya Rao — ${referenceId}`,
    );
    expect(message.idempotencyKey).toBe(`aims-admissions-${referenceId}`);
  });

  it("ignores any recipient supplied in the enquiry payload", async () => {
    const provider = createProvider(async () => ({ id: "admin_1" }));
    await sendAdmissionsNotification(
      {
        ...input,
        enquiry: {
          ...validEnquiry,
          // Simulating an attacker-controlled extra property.
          ...({ admissionsEmail: "attacker@example.com" } as object),
        },
      },
      context(provider),
    );
    const message = provider.send.mock.calls[0][0] as EmailMessage;
    expect(message.to).toBe("admissions@aims.ac.in");
  });
});

describe("dual-email orchestration", () => {
  it("sends both emails and reports both as accepted", async () => {
    const provider = createProvider(async ({ to }) => ({ id: `id-${to}` }));
    const report = await deliverEnquiryEmails(input, context(provider));

    expect(report.student).toEqual({
      status: "accepted",
      providerId: "id-ananya.rao@example.com",
    });
    expect(report.admissions).toEqual({
      status: "accepted",
      providerId: "id-admissions@aims.ac.in",
    });
    expect(provider.send).toHaveBeenCalledTimes(2);

    const messages = provider.send.mock.calls.map(
      (call) => call[0] as EmailMessage,
    );
    for (const message of messages) {
      expect(message.html).toContain(referenceId);
      expect(message.html).toContain("Ananya Rao");
    }
  });

  it("still sends the admissions notification when the student email fails", async () => {
    const provider = createProvider(async ({ to }) => {
      if (to === "ananya.rao@example.com") {
        throw new EmailProviderError("provider_unavailable", "Down");
      }
      return { id: "admin_1" };
    });

    const report = await deliverEnquiryEmails(input, context(provider));

    expect(report.student).toEqual({
      status: "failed",
      errorCode: "provider_unavailable",
    });
    expect(report.admissions).toEqual({
      status: "accepted",
      providerId: "admin_1",
    });
    expect(provider.send).toHaveBeenCalledTimes(2);
  });

  it("still sends the student email when the admissions notification fails", async () => {
    const provider = createProvider(async ({ to }) => {
      if (to === "admissions@aims.ac.in") {
        throw new EmailProviderError("provider_rate_limited", "Slow down");
      }
      return { id: "student_1" };
    });

    const report = await deliverEnquiryEmails(input, context(provider));

    expect(report.student).toEqual({
      status: "accepted",
      providerId: "student_1",
    });
    expect(report.admissions).toEqual({
      status: "failed",
      errorCode: "provider_rate_limited",
    });
  });

  it("reports both legs failed when the provider is unreachable", async () => {
    const provider = createProvider(async () => {
      throw new Error("network down");
    });
    const report = await deliverEnquiryEmails(input, context(provider));
    expect(report.student).toEqual({
      status: "failed",
      errorCode: "unknown_error",
    });
    expect(report.admissions).toEqual({
      status: "failed",
      errorCode: "unknown_error",
    });
  });
});
