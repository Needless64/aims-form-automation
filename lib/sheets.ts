import { formatIndianPhone } from "@/lib/email/fields";
import { formatSubmissionTime } from "@/lib/reference";
import type { Enquiry } from "@/lib/validation";

/**
 * Column order of the admissions spreadsheet. Frozen: the Apps Script writes the
 * header row from this list, so columns may only ever be appended, never
 * reordered, or existing rows stop lining up.
 */
export const SHEET_COLUMNS = [
  "Reference ID",
  "Submitted at (IST)",
  "Submitted at (ISO 8601)",
  "Student name",
  "Email address",
  "Mobile number",
  "Departments of interest",
  "Current city / district",
  "Current college / institution",
  "Academic or career goals",
  "Parent / guardian name",
  "Parent / guardian phone",
  "Consent to be contacted",
  "Source",
] as const;

export type SheetRecordState =
  | { status: "saved" }
  | { status: "skipped" }
  | { status: "failed"; errorCode: string };

export interface SheetConfig {
  endpoint: string;
  token: string;
  timeoutMs: number;
}

export interface SheetRecordInput {
  enquiry: Enquiry;
  referenceId: string;
  submittedAt: Date;
}

export class SheetConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SheetConfigurationError";
  }
}

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Reads the Apps Script web app endpoint. Unset means the ledger is off and the
 * enquiry still goes through — the spreadsheet is a convenience, not the only
 * record of a submission.
 */
export function getSheetConfig(
  env: Record<string, string | undefined> = process.env,
): SheetConfig | null {
  const endpoint = env.SHEETS_WEBHOOK_URL?.trim() ?? "";
  if (!endpoint) return null;

  // Personal data travels over this link, so refuse to send it in the clear.
  if (!/^https:\/\//i.test(endpoint)) {
    throw new SheetConfigurationError(
      "SHEETS_WEBHOOK_URL must be an https:// URL.",
    );
  }

  const timeout = Number(env.SHEETS_TIMEOUT_MS ?? "");
  return {
    endpoint,
    token: env.SHEETS_WEBHOOK_SECRET?.trim() ?? "",
    timeoutMs:
      Number.isFinite(timeout) && timeout > 0 ? timeout : DEFAULT_TIMEOUT_MS,
  };
}

/**
 * The mobile number as the spreadsheet should hold it. Sheets reads a leading
 * "+" as the start of a formula and shows #ERROR! in the cell, so the ledger
 * writes the number without it ("91 98765 43210"). The emails keep the "+"
 * form produced by formatIndianPhone.
 */
function sheetPhone(phone: string): string {
  return formatIndianPhone(phone).replace(/^\+/, "");
}

/** One spreadsheet row, in SHEET_COLUMNS order. */
export function sheetRow({
  enquiry,
  referenceId,
  submittedAt,
}: SheetRecordInput): string[] {
  return [
    referenceId,
    formatSubmissionTime(submittedAt),
    submittedAt.toISOString(),
    enquiry.fullName,
    enquiry.email,
    sheetPhone(enquiry.phone),
    enquiry.departments.join(", "),
    enquiry.city,
    enquiry.currentCollege,
    enquiry.goals ?? "",
    enquiry.parentName,
    enquiry.parentPhone ? sheetPhone(enquiry.parentPhone) : "",
    enquiry.consent ? "Yes" : "No",
    "AIMS admissions website",
  ];
}

function errorCodeFor(error: unknown): string {
  const name = (error as { name?: unknown })?.name;
  if (name === "TimeoutError" || name === "AbortError") return "sheet_timeout";
  if (name === "TypeError") return "sheet_unreachable";
  return "sheet_error";
}

/**
 * Appends the enquiry through the Apps Script web app. Nothing here throws: a
 * spreadsheet that is down must never cost a student their confirmation email,
 * so the caller logs the result instead of failing the submission.
 */
export async function recordEnquiry(
  input: SheetRecordInput,
  config: SheetConfig,
): Promise<SheetRecordState> {
  try {
    const response = await fetch(config.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: config.token,
        header: SHEET_COLUMNS,
        values: sheetRow(input),
      }),
      signal: AbortSignal.timeout(config.timeoutMs),
      cache: "no-store",
    });

    if (!response.ok) {
      return { status: "failed", errorCode: `sheet_http_${response.status}` };
    }

    // Apps Script answers 200 even when the script itself failed, so the body is
    // the only trustworthy signal that the row was appended.
    const body = (await response.json().catch(() => null)) as
      | { ok?: unknown }
      | null;
    if (body?.ok !== true) {
      return { status: "failed", errorCode: "sheet_rejected" };
    }

    return { status: "saved" };
  } catch (error) {
    return { status: "failed", errorCode: errorCodeFor(error) };
  }
}

/**
 * Records the enquiry when a spreadsheet is configured and does nothing when it
 * is not. Like recordEnquiry, this never throws.
 */
export async function recordEnquiryIfConfigured(
  input: SheetRecordInput,
  env: Record<string, string | undefined> = process.env,
): Promise<SheetRecordState> {
  let config: SheetConfig | null;
  try {
    config = getSheetConfig(env);
  } catch {
    return { status: "failed", errorCode: "sheet_config_error" };
  }
  if (!config) return { status: "skipped" };
  return recordEnquiry(input, config);
}
