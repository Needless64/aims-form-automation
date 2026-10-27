import type { EmailProvider } from "@/lib/email/provider";
import { EmailProviderError } from "@/lib/email/provider";
import { buildStudentConfirmation } from "@/lib/email/templates/student-confirmation";
import { buildAdmissionsNotification } from "@/lib/email/templates/admissions-notification";
import type { Enquiry } from "@/lib/validation";

/**
 * `queued` is the honest answer when the mail is sent outside this runtime:
 * the job was handed to the runner, but nothing here has seen it delivered.
 */
export type DeliveryState =
  | { status: "accepted"; providerId: string }
  | { status: "queued" }
  | { status: "failed"; errorCode: string };

/** True once a leg needs no further attempt: sent, or handed to the runner. */
export function isSettled(state: DeliveryState): boolean {
  return state.status === "accepted" || state.status === "queued";
}

export interface DeliveryReport {
  student: DeliveryState;
  admissions: DeliveryState;
}

export interface DeliveryContext {
  provider: EmailProvider;
  from: string;
  admissionsEmail: string;
  logoUrl: string;
}

export interface EnquiryEmailInput {
  enquiry: Enquiry;
  referenceId: string;
  submittedAt: Date;
}

async function toDeliveryState(
  operation: () => Promise<{ id: string }>,
): Promise<DeliveryState> {
  try {
    const result = await operation();
    return { status: "accepted", providerId: result.id };
  } catch (error) {
    if (error instanceof EmailProviderError) {
      return { status: "failed", errorCode: error.code };
    }
    return { status: "failed", errorCode: "unknown_error" };
  }
}

/** Email A — personalized confirmation to the student. */
export async function sendStudentConfirmation(
  input: EnquiryEmailInput,
  context: DeliveryContext,
): Promise<DeliveryState> {
  const built = buildStudentConfirmation({
    enquiry: input.enquiry,
    referenceId: input.referenceId,
    submittedAt: input.submittedAt,
    logoUrl: context.logoUrl,
  });

  return toDeliveryState(() =>
    context.provider.send({
      from: context.from,
      to: input.enquiry.email,
      subject: built.subject,
      html: built.html,
      text: built.text,
      idempotencyKey: `aims-student-${input.referenceId}`,
    }),
  );
}

/** Email B — detailed notification to the admissions inbox. */
export async function sendAdmissionsNotification(
  input: EnquiryEmailInput,
  context: DeliveryContext,
): Promise<DeliveryState> {
  const built = buildAdmissionsNotification({
    enquiry: input.enquiry,
    referenceId: input.referenceId,
    submittedAt: input.submittedAt,
    logoUrl: context.logoUrl,
  });

  return toDeliveryState(() =>
    context.provider.send({
      from: context.from,
      // The recipient is server-controlled; the client cannot influence it.
      to: context.admissionsEmail,
      subject: built.subject,
      html: built.html,
      text: built.text,
      replyTo: input.enquiry.email,
      idempotencyKey: `aims-admissions-${input.referenceId}`,
    }),
  );
}

/**
 * Sends both emails and tracks each result independently. A failure on one leg
 * never prevents the other from being attempted and is never reported as
 * success.
 */
export async function deliverEnquiryEmails(
  input: EnquiryEmailInput,
  context: DeliveryContext,
): Promise<DeliveryReport> {
  const student = await sendStudentConfirmation(input, context);
  const admissions = await sendAdmissionsNotification(input, context);
  return { student, admissions };
}
