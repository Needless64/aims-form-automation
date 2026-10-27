// Runtime-neutral port of the former Next.js route handler: it only uses the
// fetch Request/Response API, so the same code runs on Node and in a Worker.
import { clientIp, json } from "@/lib/api-response";
import type { ServerEnv } from "@/lib/api/env";
import { enquiryStore } from "@/lib/enquiry-store";
import { deliverEnquiry } from "@/lib/email/dispatch";
import { EmailConfigurationError, getEmailConfig } from "@/lib/email/config";
import { isSettled, type DeliveryReport } from "@/lib/email/service";
import { INSTITUTION } from "@/lib/institution";
import { enquiryRateLimiter } from "@/lib/rate-limit";
import { formatSubmissionTime, generateReferenceId } from "@/lib/reference";
import { recordEnquiryIfConfigured, type SheetRecordState } from "@/lib/sheets";
import {
  HONEYPOT_FIELD,
  enquirySchema,
  formatFieldErrors,
} from "@/lib/validation";

const MAX_BODY_BYTES = 16 * 1024;

function logDelivery(referenceId: string, deliveries: DeliveryReport) {
  console.info(
    JSON.stringify({
      event: "enquiry_delivery",
      referenceId,
      student: deliveries.student.status,
      studentError:
        deliveries.student.status === "failed"
          ? deliveries.student.errorCode
          : undefined,
      admissions: deliveries.admissions.status,
      admissionsError:
        deliveries.admissions.status === "failed"
          ? deliveries.admissions.errorCode
          : undefined,
    }),
  );
}

function logRecord(referenceId: string, record: SheetRecordState) {
  console.info(
    JSON.stringify({
      event: "enquiry_recorded",
      referenceId,
      spreadsheet: record.status,
      spreadsheetError:
        record.status === "failed" ? record.errorCode : undefined,
    }),
  );
}

export async function handleEnquiry(
  request: Request,
  env: ServerEnv = process.env,
): Promise<Response> {
  const ip = clientIp(request);
  const rate = enquiryRateLimiter(ip);
  if (!rate.allowed) {
    return json(
      {
        ok: false,
        error: "rate_limited",
        message:
          "Too many enquiries have been submitted from this connection. Please wait a few minutes and try again.",
      },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      },
    );
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return json(
      { ok: false, error: "unsupported_media_type" },
      { status: 415 },
    );
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return json({ ok: false, error: "payload_too_large" }, { status: 413 });
  }

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) {
    return json({ ok: false, error: "payload_too_large" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const candidate = body as Record<string, unknown>;
  const honeypot = candidate[HONEYPOT_FIELD];
  if (typeof honeypot === "string" && honeypot.trim() !== "") {
    // Do not reveal that the honeypot was the reason.
    return json(
      {
        ok: false,
        error: "submission_rejected",
        message: "This submission could not be processed.",
      },
      { status: 400 },
    );
  }

  const parsed = enquirySchema.safeParse(candidate);
  if (!parsed.success) {
    return json(
      {
        ok: false,
        error: "validation_error",
        message: "Please check the highlighted fields and try again.",
        fieldErrors: formatFieldErrors(parsed.error),
      },
      { status: 422 },
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
    return json(
      {
        ok: false,
        error: "email_not_configured",
        message: `Online enquiries are temporarily unavailable. Please call our admissions helpline on ${INSTITUTION.phone}.`,
      },
      { status: 503 },
    );
  }

  const submittedAt = new Date();
  let referenceId = generateReferenceId(submittedAt);
  // Avoid collisions with enquiries still tracked in memory.
  for (
    let attempt = 0;
    attempt < 5 && enquiryStore.get(referenceId);
    attempt += 1
  ) {
    referenceId = generateReferenceId(submittedAt);
  }
  // The spreadsheet entry and the two emails are independent; neither waits on
  // the other, and a ledger that is down never costs the student a confirmation.
  const [deliveries, record] = await Promise.all([
    deliverEnquiry({ enquiry: parsed.data, referenceId, submittedAt }, config),
    recordEnquiryIfConfigured(
      {
        enquiry: parsed.data,
        referenceId,
        submittedAt,
      },
      env,
    ),
  ]);

  enquiryStore.save({
    referenceId,
    enquiry: parsed.data,
    submittedAt: submittedAt.toISOString(),
    deliveries,
  });

  logDelivery(referenceId, deliveries);
  logRecord(referenceId, record);

  // With the GitHub transport a leg is `queued`: the runner owns the send from
  // here, so the site reports "accepted" for it only once the runner has run.
  const bothHandled =
    isSettled(deliveries.student) && isSettled(deliveries.admissions);

  const publicDeliveries = {
    student: deliveries.student.status,
    admissions: deliveries.admissions.status,
  };

  if (bothHandled) {
    return json({
      ok: true,
      referenceId,
      submittedAt: submittedAt.toISOString(),
      timeLabel: formatSubmissionTime(submittedAt),
      deliveries: publicDeliveries,
      recorded: record.status,
    });
  }

  const anyHandled =
    isSettled(deliveries.student) || isSettled(deliveries.admissions);

  return json(
    {
      ok: false,
      error: "email_delivery_failed",
      message: anyHandled
        ? `Your enquiry was recorded, but we could not complete both confirmation emails. Please contact our admissions team on ${INSTITUTION.phone} and quote your reference number.`
        : `We could not send your enquiry right now. Please try again, or call our admissions helpline on ${INSTITUTION.phone}.`,
      partial: anyHandled,
      referenceId,
      submittedAt: submittedAt.toISOString(),
      timeLabel: formatSubmissionTime(submittedAt),
      deliveries: publicDeliveries,
      recorded: record.status,
    },
    { status: 502 },
  );
}
