// Runtime-neutral port of the former Next.js route handler. The bearer check
// compares bytes in constant time without node:crypto, so it runs unchanged on
// Node and in a Worker.
import { json } from "@/lib/api-response";
import type { ServerEnv } from "@/lib/api/env";
import { enquiryStore } from "@/lib/enquiry-store";
import { deliverEnquiry } from "@/lib/email/dispatch";
import { EmailConfigurationError, getEmailConfig } from "@/lib/email/config";
import { createEmailProvider } from "@/lib/email/provider";
import {
  isSettled,
  sendAdmissionsNotification,
  sendStudentConfirmation,
  type DeliveryState,
} from "@/lib/email/service";

const encoder = new TextEncoder();

function tokenMatches(provided: string, expected: string): boolean {
  const a = encoder.encode(provided);
  const b = encoder.encode(expected);
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= a[index] ^ b[index];
  }
  return difference === 0;
}

/**
 * Controlled retry for a failed delivery leg. Only the leg that failed is
 * re-sent; an already-accepted email is never repeated. Protected by
 * ADMIN_RETRY_TOKEN and disabled when that variable is unset.
 */
export async function handleRetry(
  request: Request,
  env: ServerEnv = process.env,
): Promise<Response> {
  const expectedToken = env.ADMIN_RETRY_TOKEN?.trim();
  if (!expectedToken) {
    return json({ ok: false, error: "retry_disabled" }, { status: 503 });
  }

  const authorization = request.headers.get("authorization") ?? "";
  const provided = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
  if (!provided || !tokenMatches(provided, expectedToken)) {
    return json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const referenceId =
    typeof body === "object" && body !== null
      ? (body as { referenceId?: unknown }).referenceId
      : undefined;

  if (
    typeof referenceId !== "string" ||
    !/^AIMS-\d{2}-[A-Z2-9]{6}$/.test(referenceId)
  ) {
    return json({ ok: false, error: "invalid_reference" }, { status: 400 });
  }

  const record = enquiryStore.get(referenceId);
  if (!record) {
    return json({ ok: false, error: "not_found" }, { status: 404 });
  }

  // Only a known-accepted leg blocks a retry. A queued one is deliberately
  // retryable: the runner may have failed long after the site answered, and
  // this endpoint is the staff's only way to send the mail again.
  if (
    record.deliveries.student.status === "accepted" &&
    record.deliveries.admissions.status === "accepted"
  ) {
    return json(
      {
        ok: false,
        error: "already_delivered",
        message: "Both emails for this enquiry have already been accepted.",
      },
      { status: 409 },
    );
  }

  let config;
  try {
    config = getEmailConfig(env);
  } catch (error) {
    const detail =
      error instanceof EmailConfigurationError
        ? error.message
        : "Email configuration is invalid.";
    console.error(JSON.stringify({ event: "email_config_error", detail }));
    return json({ ok: false, error: "email_not_configured" }, { status: 503 });
  }

  const input = {
    enquiry: record.enquiry,
    referenceId: record.referenceId,
    submittedAt: new Date(record.submittedAt),
  };

  let student: DeliveryState = record.deliveries.student;
  let admissions: DeliveryState = record.deliveries.admissions;

  if (config.transport === "github") {
    // The runner builds and sends both emails from one job, so a retry hands
    // the whole job over again rather than a single leg.
    const report = await deliverEnquiry(input, config);
    student = report.student;
    admissions = report.admissions;
  } else {
    const context = {
      provider: createEmailProvider(config),
      from: config.from,
      admissionsEmail: config.admissionsEmail,
      logoUrl: config.logoUrl,
    };

    if (student.status !== "accepted") {
      student = await sendStudentConfirmation(input, context);
    }

    if (admissions.status !== "accepted") {
      admissions = await sendAdmissionsNotification(input, context);
    }
  }

  enquiryStore.updateDelivery(referenceId, "student", student);
  enquiryStore.updateDelivery(referenceId, "admissions", admissions);

  console.info(
    JSON.stringify({
      event: "enquiry_retry",
      referenceId,
      student: student.status,
      admissions: admissions.status,
    }),
  );

  const bothHandled = isSettled(student) && isSettled(admissions);

  return json(
    {
      ok: bothHandled,
      referenceId,
      deliveries: {
        student: student.status,
        admissions: admissions.status,
      },
      ...(bothHandled
        ? {}
        : {
            error: "email_delivery_failed",
            message: "One or more email legs still failed.",
          }),
    },
    { status: bothHandled ? 200 : 502 },
  );
}
