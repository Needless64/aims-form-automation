// Runs on a GitHub Actions runner, not on the site.
//
// A Cloudflare Worker has no raw sockets, so the site cannot speak SMTP; it
// dispatches this job instead, carrying the enquiry sealed with a shared key.
// Here the payload is opened and both emails go out through the same mailbox
// and the same templates the site would have used.
//
// This repository is public and a workflow run's log is readable by anyone, so
// nothing below prints the enquiry — only its reference ID and the outcomes.
import { appendFileSync } from "node:fs";
import { getEmailConfig } from "@/lib/email/config";
import { createSmtpProvider } from "@/lib/email/provider";
import {
  deliverEnquiryEmails,
  type DeliveryState,
} from "@/lib/email/service";
import { openMailPayload } from "@/lib/mail-payload";

function describe(state: DeliveryState): string {
  return state.status === "failed"
    ? `failed (${state.errorCode})`
    : state.status;
}

function summarise(markdown: string): void {
  const path = process.env.GITHUB_STEP_SUMMARY;
  if (!path) return;
  try {
    appendFileSync(path, `${markdown}\n`);
  } catch {
    // A missing summary file must never fail the send.
  }
}

async function main(): Promise<boolean> {
  const token = process.env.MAIL_PAYLOAD?.trim() ?? "";
  const payloadKey = process.env.MAIL_PAYLOAD_KEY?.trim() ?? "";
  if (!token || !payloadKey) {
    throw new Error("MAIL_PAYLOAD and MAIL_PAYLOAD_KEY must both be set.");
  }

  // Throws on a tampered token, a wrong key or a malformed enquiry: nothing is
  // sent from data this script has not checked.
  const payload = await openMailPayload(token, payloadKey);

  const config = getEmailConfig({ ...process.env, EMAIL_TRANSPORT: "smtp" });
  if (!config.smtp) throw new Error("SMTP settings are missing.");

  const report = await deliverEnquiryEmails(
    {
      enquiry: payload.enquiry,
      referenceId: payload.referenceId,
      submittedAt: new Date(payload.submittedAt),
    },
    {
      provider: createSmtpProvider(config.smtp),
      from: config.from,
      admissionsEmail: config.admissionsEmail,
      logoUrl: config.logoUrl,
    },
  );

  const ok =
    report.student.status === "accepted" &&
    report.admissions.status === "accepted";

  console.log(
    `reference ${payload.referenceId}: student=${describe(report.student)} admissions=${describe(report.admissions)}`,
  );
  summarise(
    [
      `### Enquiry \`${payload.referenceId}\``,
      "",
      `- Student confirmation: **${describe(report.student)}**`,
      `- Admissions notification: **${describe(report.admissions)}**`,
    ].join("\n"),
  );

  return ok;
}

main()
  .then((ok) => {
    // A red run is the only signal the site never sees, so it must be accurate.
    if (!ok) process.exitCode = 1;
  })
  .catch((error: unknown) => {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(`mail job failed: ${detail}`);
    summarise(`### Mail job failed\n\n\`${detail}\``);
    process.exitCode = 1;
  });
