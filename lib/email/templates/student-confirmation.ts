import {
  EMAIL_COLORS,
  H,
  brandHeader,
  ctaRow,
  detailRows,
  emailFooter,
  factGrid,
  paragraph,
  receiptBand,
  renderEmailDocument,
  sectionHeading,
  stepList,
  textLink,
} from "@/lib/email/components";
import { studentDetailFields, formatIndianPhone } from "@/lib/email/fields";
import { INSTITUTION } from "@/lib/institution";
import { sanitizeHeaderValue } from "@/lib/escape";
import { formatSubmissionTime } from "@/lib/reference";
import type { Enquiry } from "@/lib/validation";

export interface StudentEmailInput {
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
const SERIF = "Georgia,'Times New Roman',serif";

export function buildStudentConfirmation({
  enquiry,
  referenceId,
  submittedAt,
  logoUrl,
}: StudentEmailInput): BuiltEmail {
  const safeName = sanitizeHeaderValue(enquiry.fullName, 100);
  const fields = studentDetailFields(enquiry, referenceId);
  const timeLabel = formatSubmissionTime(submittedAt);

  const subject = `Your AIMS Admissions Enquiry Has Been Received — ${safeName}`;

  const header = brandHeader({
    logoUrl,
    eyebrow: `Admissions ${INSTITUTION.academicYear}`,
    title: `Welcome, ${safeName}!`,
    subtitle:
      "Arundathi Institute of Medical Sciences is glad to hear from you. Keep this email — your reference number is on it.",
  });

  const summary = receiptBand([
    { label: "Reference ID", value: referenceId, mono: true },
    { label: "Submitted", value: timeLabel },
    { label: "Programme of interest", value: enquiry.course },
  ]);

  const intro = `<tr>
  <td class="mobile-pad" style="padding:32px 32px 6px 32px;">
    ${paragraph(
      `Dear <strong style="color:${EMAIL_COLORS.navy};">${H(safeName)}</strong>,`,
      { size: 16, line: 25, margin: "0 0 14px 0" },
    )}
    ${paragraph(
      "Thank you for your interest in Arundathi Institute of Medical Sciences. Your admissions enquiry has reached us, and a copy of everything you submitted is recorded below.",
    )}
    ${paragraph(
      "Our admissions team will review it and contact you using the details you provided.",
      { margin: "0 0 26px 0" },
    )}
  </td>
</tr>`;

  const submissionCard = `<tr>
  <td class="mobile-pad" style="padding:0 32px 28px 32px;">
    ${sectionHeading("Your submission", "What you told us")}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${EMAIL_COLORS.paper};border:1px solid ${EMAIL_COLORS.line};border-radius:8px;">
      <tr>
        <td style="padding:6px 22px 10px 22px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            ${detailRows(fields)}
          </table>
        </td>
      </tr>
    </table>
  </td>
</tr>`;

  const nextSteps = `<tr>
  <td class="mobile-pad" style="padding:0 32px 28px 32px;">
    ${sectionHeading("What happens next", "Three steps from here")}
    ${stepList([
      {
        title: "Your enquiry is reviewed",
        body: "Our admissions team reads the details you submitted, including your programme of interest and NEET-UG status.",
      },
      {
        title: "We get in touch",
        body: `A counsellor contacts you on ${formatIndianPhone(enquiry.phone)} or ${enquiry.email}.`,
      },
      {
        title: "You take it forward",
        body: `We help with programme information, admission requirements and KNRUHS counselling, which uses the code ${INSTITUTION.counsellingCode}.`,
      },
    ])}
  </td>
</tr>`;

  const discover = `<tr>
  <td class="mobile-pad" style="padding:0 32px 28px 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${EMAIL_COLORS.mist};border-radius:10px;">
      <tr>
        <td style="padding:24px 24px 18px 24px;">
          ${sectionHeading("Discover AIMS")}
          <div style="font-family:${SERIF};font-size:21px;line-height:28px;color:${EMAIL_COLORS.navy};">A medical education rooted in care</div>
          ${paragraph(
            "Arundathi Institute of Medical Sciences is a medical college and teaching hospital in Dundigal, Telangana. Explore the campus and programme information before your counselling.",
            { color: EMAIL_COLORS.slate, size: 14, line: 22, margin: "8px 0 20px 0" },
          )}
          ${factGrid([
            ["Established", String(INSTITUTION.established)],
            ["Affiliated to", INSTITUTION.affiliationShort],
            ["Approval", INSTITUTION.approvalShort],
            ["Counselling code", INSTITUTION.counsellingCode],
          ])}
          <div style="padding-top:6px;">
            ${ctaRow([
              { href: INSTITUTION.virtualTour, label: "Take the virtual campus tour" },
              { href: INSTITUTION.website, label: "Visit aims.ac.in", variant: "secondary" },
            ])}
          </div>
          ${paragraph(
            `${textLink(INSTITUTION.website, "aims.ac.in")} for programme and admission details.`,
            { color: EMAIL_COLORS.muted, size: 12.5, line: 19, margin: "2px 0 0 0" },
          )}
        </td>
      </tr>
    </table>
  </td>
</tr>`;

  const closing = `<tr>
  <td class="mobile-pad" style="padding:0 32px 26px 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="padding:2px 0 2px 18px;border-left:3px solid ${EMAIL_COLORS.ice};">
          ${paragraph("We look forward to connecting with you.", {
            color: EMAIL_COLORS.navy,
            size: 15,
            line: 23,
            margin: "0 0 16px 0",
          })}
          <div style="font-family:${SANS};font-size:14px;line-height:22px;color:${EMAIL_COLORS.ink};">With regards,</div>
          <div style="margin-top:2px;font-family:${SERIF};font-size:17px;line-height:24px;color:${EMAIL_COLORS.navy};">The AIMS Admissions Team</div>
          <div style="margin-top:3px;font-family:${SANS};font-size:11px;line-height:17px;letter-spacing:1.2px;text-transform:uppercase;color:${EMAIL_COLORS.muted};">Arundathi Institute of Medical Sciences</div>
        </td>
      </tr>
    </table>
  </td>
</tr>`;

  const help = `<tr>
  <td class="mobile-pad" style="padding:0 32px 30px 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${EMAIL_COLORS.line};border-radius:8px;">
      <tr>
        <td style="padding:16px 20px;font-family:${SANS};font-size:13px;line-height:21px;color:${EMAIL_COLORS.slate};">
          <strong style="color:${EMAIL_COLORS.navy};">Need help with your enquiry?</strong> Quote your reference <span style="font-weight:700;color:${EMAIL_COLORS.navy};">${H(referenceId)}</span> and call <a href="tel:${INSTITUTION.phoneHref}" style="color:${EMAIL_COLORS.navy};font-weight:700;text-decoration:none;">${INSTITUTION.phone}</a> or write to <a href="mailto:${INSTITUTION.admissionsEmail}" style="color:${EMAIL_COLORS.navy};font-weight:700;text-decoration:none;">${INSTITUTION.admissionsEmail}</a>.
        </td>
      </tr>
    </table>
  </td>
</tr>`;

  const html = renderEmailDocument({
    title: subject,
    preheader: `Enquiry received — reference ${referenceId}. Here is what happens next.`,
    content: `${header}
${summary}
${intro}
${submissionCard}
${nextSteps}
${discover}
${closing}
${help}
${emailFooter({ referenceId })}`,
  });

  const textFields = fields
    .filter((field) => field.value)
    .map((field) => `${field.label}: ${field.value}`)
    .join("\n");

  const text = `ARUNDATHI INSTITUTE OF MEDICAL SCIENCES AND HOSPITAL
ADMISSIONS ${INSTITUTION.academicYear}

Dear ${enquiry.fullName},

Thank you for your interest in Arundathi Institute of Medical Sciences. Your admissions enquiry has reached us, and a copy of everything you submitted is recorded below.

Our admissions team will review it and contact you using the details you provided.

REFERENCE ${referenceId}
Submitted: ${timeLabel}

YOUR SUBMISSION
${textFields}

WHAT HAPPENS NEXT
1. Your enquiry is reviewed - our admissions team reads the details you submitted, including your programme of interest and NEET-UG status.
2. We get in touch - a counsellor contacts you on ${formatIndianPhone(enquiry.phone)} or ${enquiry.email}.
3. You take it forward - we help with programme information, admission requirements and KNRUHS counselling, which uses the code ${INSTITUTION.counsellingCode}.

DISCOVER AIMS
- Established ${INSTITUTION.established}
- Affiliated to Kaloji Narayana Rao University of Health Sciences (KNRUHS)
- NMC Approved
- Counselling code: AIMD

Virtual campus tour: ${INSTITUTION.virtualTour}
Official website: ${INSTITUTION.website}

We look forward to connecting with you.

With regards,
The AIMS Admissions Team
Arundathi Institute of Medical Sciences

Arundathi Institute of Medical Sciences and Hospital
${INSTITUTION.address}
Admissions: ${formatIndianPhone(INSTITUTION.phone)} (${INSTITUTION.phoneHref})
Website: ${INSTITUTION.website}
Counselling code: AIMD

You received this email because you submitted an admissions enquiry on the official AIMS website.
Reference ID: ${referenceId}
`;

  return { subject, html, text };
}
