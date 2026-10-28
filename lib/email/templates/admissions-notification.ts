import {
  EMAIL_COLORS,
  H,
  button,
  detailRows,
  emailFooter,
  internalHeader,
  paragraph,
  receiptBand,
  renderEmailDocument,
  sectionHeading,
  textLink,
  type DetailField,
} from "@/lib/email/components";
import { formatIndianPhone, studentDetailFields } from "@/lib/email/fields";
import { sanitizeHeaderValue } from "@/lib/escape";
import { INSTITUTION } from "@/lib/institution";
import { formatSubmissionTime } from "@/lib/reference";
import type { Enquiry } from "@/lib/validation";

export interface AdmissionsEmailInput {
  enquiry: Enquiry;
  referenceId: string;
  submittedAt: Date;
  logoUrl: string;
}

export interface BuiltEmail {
  subject: string;
  html: string;
  text: string;
}

const SANS =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = "'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace";

/** The consent chip is the one place a status colour is warranted. */
const CONSENT_BG = "#f2f7f2";
const CONSENT_RULE = "#4a7c59";
const CONSENT_INK = "#274233";

export function buildAdmissionsNotification({
  enquiry,
  referenceId,
  submittedAt,
  logoUrl,
}: AdmissionsEmailInput): BuiltEmail {
  const safeName = sanitizeHeaderValue(enquiry.fullName, 100);
  const timeLabel = formatSubmissionTime(submittedAt);

  const subject = `New AIMS Admissions Enquiry — ${safeName} — ${referenceId}`;

  const allFields = studentDetailFields(enquiry, referenceId);
  const detailFieldLabels = new Set([
    "Programme of interest",
    "City / district",
    "Current college / institution",
    "Areas of interest",
    "Academic / career goals",
    "Parent / guardian",
  ]);
  const enquiryFields: DetailField[] = allFields.filter((field) =>
    detailFieldLabels.has(field.label),
  );

  const studentMailto = `mailto:${enquiry.email}?subject=${encodeURIComponent(
    `Re: Your AIMS admissions enquiry — ${referenceId}`,
  )}`;

  const header = internalHeader({
    logoUrl,
    eyebrow: INSTITUTION.academicYear,
    title: "NEW ADMISSIONS ENQUIRY",
    subtitle:
      "A prospective student has submitted an enquiry through the AIMS admissions website. Every response is recorded below.",
  });

  const summary = receiptBand([
    { label: "Reference ID", value: referenceId, mono: true },
    { label: "Submitted", value: timeLabel },
    { label: "Programme of interest", value: enquiry.programme },
  ]);

  const contactSection = `<tr>
  <td class="mobile-pad" style="padding:28px 32px 6px 32px;">
    ${sectionHeading("Student contact details", safeName)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${EMAIL_COLORS.paper};border:1px solid ${EMAIL_COLORS.line};border-radius:8px;overflow:hidden;">
      <tr>
        <td class="contact-cell" width="34%" valign="top" style="padding:18px 20px;">
          <div style="font-family:${SANS};font-size:10px;line-height:15px;font-weight:700;letter-spacing:1.3px;text-transform:uppercase;color:${EMAIL_COLORS.muted};">Email</div>
          <div style="margin-top:5px;font-family:${SANS};font-size:13.5px;line-height:20px;"><a href="${H(studentMailto)}" style="color:${EMAIL_COLORS.navy};font-weight:600;text-decoration:underline;">${H(enquiry.email)}</a></div>
        </td>
        <td class="contact-cell" width="33%" valign="top" style="padding:18px 20px;border-left:1px solid ${EMAIL_COLORS.line};">
          <div style="font-family:${SANS};font-size:10px;line-height:15px;font-weight:700;letter-spacing:1.3px;text-transform:uppercase;color:${EMAIL_COLORS.muted};">Phone</div>
          <div style="margin-top:5px;font-family:${SANS};font-size:13.5px;line-height:20px;"><a href="tel:+91${H(enquiry.phone)}" style="color:${EMAIL_COLORS.navy};font-weight:600;text-decoration:underline;">${H(formatIndianPhone(enquiry.phone))}</a></div>
        </td>
        <td class="contact-cell" width="33%" valign="top" style="padding:18px 20px;border-left:1px solid ${EMAIL_COLORS.line};">
          <div style="font-family:${SANS};font-size:10px;line-height:15px;font-weight:700;letter-spacing:1.3px;text-transform:uppercase;color:${EMAIL_COLORS.muted};">Programme</div>
          <div style="margin-top:5px;font-family:${SANS};font-size:13.5px;line-height:20px;color:${EMAIL_COLORS.navy};">${H(enquiry.programme)}</div>
        </td>
      </tr>
    </table>
    <div style="margin-top:10px;font-family:${SANS};font-size:12px;line-height:18px;color:${EMAIL_COLORS.muted};">Reply directly to this email to reach the student (Reply-To is set to their address).</div>
  </td>
</tr>`;

  const enquirySection = `<tr>
  <td class="mobile-pad" style="padding:22px 32px 4px 32px;">
    ${sectionHeading("Enquiry details", "What the student submitted")}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${EMAIL_COLORS.line};">
      ${detailRows(enquiryFields)}
    </table>
  </td>
</tr>`;

  const consent = `<tr>
  <td class="mobile-pad" style="padding:20px 32px 4px 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${CONSENT_BG};border-left:3px solid ${CONSENT_RULE};border-radius:0 6px 6px 0;">
      <tr>
        <td style="padding:13px 16px;font-family:${SANS};font-size:13px;line-height:20px;color:${CONSENT_INK};">
          <strong>Consent to be contacted:</strong> recorded &mdash; the student agreed to be contacted about this enquiry.
        </td>
      </tr>
    </table>
  </td>
</tr>`;

  const actions = `<tr>
  <td class="mobile-pad" style="padding:24px 32px 8px 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${EMAIL_COLORS.line};">
      <tr>
        <td style="padding-top:22px;">
          ${paragraph("Start with a reply — the student is expecting to hear from the admissions team.", {
            color: EMAIL_COLORS.slate,
            size: 13.5,
            line: 21,
            margin: "0 0 14px 0",
          })}
          ${button(studentMailto, "Reply to the student")}
          <div style="font-family:${SANS};font-size:13px;line-height:21px;color:${EMAIL_COLORS.muted};">
            ${textLink(INSTITUTION.website, "Open the official AIMS website")}
            &nbsp;&middot;&nbsp; Admissions helpline: <a href="tel:${INSTITUTION.phoneHref}" style="color:${EMAIL_COLORS.navy};text-decoration:none;font-weight:600;">${INSTITUTION.phone}</a>
          </div>
        </td>
      </tr>
    </table>
  </td>
</tr>`;

  const html = renderEmailDocument({
    title: subject,
    preheader: `New enquiry from ${safeName} — reference ${referenceId}, submitted ${timeLabel}.`,
    content: `${header}
${summary}
${contactSection}
${enquirySection}
${consent}
${actions}
${emailFooter({ referenceId, internal: true })}`,
  });

  const textDetailFields = enquiryFields
    .filter((field) => field.value)
    .map((field) => `${field.label}: ${field.value}`)
    .join("\n");

  const text = `ARUNDATHI INSTITUTE OF MEDICAL SCIENCES AND HOSPITAL
ADMISSIONS ${INSTITUTION.academicYear}

NEW ADMISSIONS ENQUIRY

Reference ID: ${referenceId}
Submitted: ${timeLabel}

STUDENT CONTACT DETAILS
Name: ${enquiry.fullName}
Email: ${enquiry.email}
Phone: ${formatIndianPhone(enquiry.phone)}
Programme: ${enquiry.programme}

ENQUIRY DETAILS
${textDetailFields}

Consent to be contacted: recorded

Reply directly to this email to reach the student (Reply-To is set to their address).
Official website: ${INSTITUTION.website}
Admissions helpline: ${INSTITUTION.phone}
Counselling code: AIMD

This is an internal notification generated for the AIMS admissions team. It contains personal data; handle it in line with the institution's privacy policy.
Reference ID: ${referenceId}
`;

  return { subject, html, text };
}
