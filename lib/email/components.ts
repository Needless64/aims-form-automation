import { escapeHtml } from "@/lib/escape";

/**
 * Every colour used by both templates, in one place. The palette mirrors the
 * website: deep navy for the brand bands, cream for the document strip that
 * carries the reference, and a cool grey for the supporting text.
 */
export const EMAIL_COLORS = {
  // Matches the background baked into the header lockup, so the opaque image
  // sits on the band without a seam. Change both together.
  navyDeep: "#0d2346",
  navyMid: "#14304f",
  navy: "#1f3351",
  navySoft: "#2c4a6e",
  slate: "#4b6382",
  steel: "#7f9bb5",
  sky: "#a9c2d9",
  ice: "#dbe7ef",
  mist: "#eef3f7",
  cream: "#fbf9f4",
  creamLine: "#e8e1d3",
  paper: "#f7f9fb",
  line: "#e3e9f0",
  ink: "#16202c",
  muted: "#5f7488",
  white: "#ffffff",
} as const;

const SANS =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const SERIF = "Georgia,'Times New Roman',serif";
const MONO = "'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace";

const ON_NAVY = "#c3d4e3";
const ON_NAVY_DIM = "#93aac2";

export const H = escapeHtml;

interface DocumentOptions {
  title: string;
  preheader: string;
  content: string;
}

/**
 * Shared 640px, table-based shell. Critical styles are inline; the style block
 * only carries the mobile stacking rules that email clients may support.
 *
 * `color-scheme:light only` keeps the navy bands navy: without it, clients that
 * force dark mode invert them to near-black and the white lockup sits on a
 * muddy rectangle.
 */
export function renderEmailDocument({
  title,
  preheader,
  content,
}: DocumentOptions): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light only" />
<meta name="supported-color-schemes" content="light only" />
<meta name="x-apple-disable-message-reformatting" />
<meta name="format-detection" content="telephone=no" />
<title>${H(title)}</title>
<!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
<style type="text/css">
  :root { color-scheme: light only; }
  body { margin:0 !important; padding:0 !important; width:100% !important; }
  table { border-collapse:collapse; }
  img { -ms-interpolation-mode:bicubic; }
  a { text-decoration:none; }
  @media only screen and (max-width:620px) {
    .email-container { width:100% !important; max-width:100% !important; border-radius:0 !important; }
    .px { padding-left:20px !important; padding-right:20px !important; }
    .mobile-pad { padding-left:20px !important; padding-right:20px !important; }
    .hero-title { font-size:29px !important; line-height:35px !important; }
    .internal-title { font-size:24px !important; line-height:30px !important; }
    .brand-lockup { width:240px !important; }
    .stack, .stack-label, .stack-value { display:block !important; width:100% !important; }
    .stack-label { padding:14px 0 2px !important; border-bottom:0 !important; }
    .stack-value { padding:0 0 14px !important; border-bottom:1px solid ${EMAIL_COLORS.line} !important; }
    .fact-cell, .stat-cell { display:block !important; width:100% !important; padding:0 0 10px 0 !important; }
    .band-cell { display:block !important; width:100% !important; padding:0 0 14px 0 !important; text-align:left !important; }
    .contact-cell { display:block !important; width:100% !important; border-left:0 !important; border-top:1px solid ${EMAIL_COLORS.line} !important; padding:12px 20px !important; }
    .contact-cell:first-child { border-top:0 !important; }
    .meta-cell { display:block !important; width:100% !important; padding:0 0 12px 0 !important; text-align:left !important; }
    .footer-cell { display:block !important; width:100% !important; padding:0 0 16px 0 !important; }
    .cta-cell { display:block !important; width:100% !important; padding:0 0 10px 0 !important; }
    .cta-cell .cta-button { display:block !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:#e9eef3;">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;font-family:${SANS};color:#e9eef3;">${H(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#e9eef3" style="background-color:#e9eef3;">
  <tr>
    <td align="center" style="padding:30px 12px;">
      <table role="presentation" class="email-container" width="640" cellpadding="0" cellspacing="0" border="0" style="width:640px;max-width:640px;background-color:${EMAIL_COLORS.white};border:1px solid #dde5ee;border-radius:14px;overflow:hidden;">
        ${content}
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

/** The 3px steel rule that closes the brand band. */
export function accentStrip(): string {
  return `<tr><td height="3" bgcolor="${EMAIL_COLORS.steel}" style="height:3px;font-size:0;line-height:0;background-color:${EMAIL_COLORS.steel};">&nbsp;</td></tr>`;
}

export function eyebrow(text: string, color = EMAIL_COLORS.slate): string {
  return `<div style="font-family:${SANS};font-size:11px;line-height:16px;font-weight:700;letter-spacing:2.2px;text-transform:uppercase;color:${color};">${H(text)}</div>`;
}

export function sectionTitle(text: string): string {
  return `<h2 style="margin:0 0 10px 0;font-family:${SERIF};font-size:24px;line-height:31px;font-weight:400;color:${EMAIL_COLORS.navy};">${H(text)}</h2>`;
}

export function paragraph(
  html: string,
  options: { color?: string; size?: number; line?: number; margin?: string } = {},
): string {
  const color = options.color ?? EMAIL_COLORS.ink;
  const size = options.size ?? 15;
  const line = options.line ?? 24;
  const margin = options.margin ?? "0 0 16px 0";
  return `<p style="margin:${margin};font-family:${SANS};font-size:${size}px;line-height:${line}px;color:${color};">${html}</p>`;
}

/**
 * A section header inside the body: a letterspaced eyebrow over a rule, so the
 * page reads as a set of labelled blocks instead of one long column of text.
 */
export function sectionHeading(label: string, title?: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px 0;">
  <tr>
    <td style="border-bottom:1px solid ${EMAIL_COLORS.line};padding-bottom:9px;">
      ${eyebrow(label)}
      ${title ? `<div style="margin-top:5px;font-family:${SERIF};font-size:20px;line-height:27px;color:${EMAIL_COLORS.navy};">${H(title)}</div>` : ""}
    </td>
  </tr>
</table>`;
}

interface ButtonSpec {
  href: string;
  label: string;
  variant?: "primary" | "secondary";
}

function singleButton({ href, label, variant = "primary" }: ButtonSpec) {
  const background =
    variant === "primary" ? EMAIL_COLORS.navy : EMAIL_COLORS.white;
  const color =
    variant === "primary" ? EMAIL_COLORS.white : EMAIL_COLORS.navy;
  const border =
    variant === "primary" ? EMAIL_COLORS.navy : EMAIL_COLORS.line;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
  <tr>
    <td class="cta-button" align="center" bgcolor="${background}" style="background-color:${background};border:1px solid ${border};border-radius:7px;">
      <a href="${H(href)}" style="display:block;padding:14px 22px;font-family:${SANS};font-size:14px;line-height:20px;font-weight:700;color:${color};text-decoration:none;letter-spacing:0.3px;">${H(label)}</a>
    </td>
  </tr>
</table>`;
}

export function button(
  href: string,
  label: string,
  variant: "primary" | "secondary" = "primary",
): string {
  return `<div style="margin:0 0 12px 0;max-width:320px;">${singleButton({ href, label, variant })}</div>`;
}

/** Buttons sit side by side on desktop and stack on a phone. */
export function ctaRow(buttons: ButtonSpec[]): string {
  const width = `${Math.floor(100 / buttons.length)}%`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px 0;">
  <tr>
    ${buttons
      .map(
        (spec, index) =>
          `<td class="cta-cell" width="${width}" valign="top" style="padding:0 ${index === buttons.length - 1 ? 0 : 6}px 10px 0;">${singleButton(spec)}</td>`,
      )
      .join("\n    ")}
  </tr>
</table>`;
}

export function textLink(href: string, label: string, color = EMAIL_COLORS.navy): string {
  return `<a href="${H(href)}" style="font-family:${SANS};font-size:14px;line-height:22px;color:${color};text-decoration:underline;">${H(label)}</a>`;
}

export interface DetailField {
  label: string;
  value?: string;
}

/** Renders only fields the student actually supplied. */
export function detailRows(fields: DetailField[]): string {
  return fields
    .filter((field) => field.value !== undefined && field.value !== "")
    .map(
      (field, index, list) => `<tr>
  <td class="stack-label" width="38%" valign="top" style="padding:13px 16px 13px 0;border-bottom:${index === list.length - 1 ? "0" : `1px solid ${EMAIL_COLORS.line}`};font-family:${SANS};font-size:10.5px;line-height:18px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:${EMAIL_COLORS.muted};vertical-align:top;">${H(field.label)}</td>
  <td class="stack-value" width="62%" valign="top" style="padding:13px 0;border-bottom:${index === list.length - 1 ? "0" : `1px solid ${EMAIL_COLORS.line}`};font-family:${SANS};font-size:15px;line-height:22px;font-weight:500;color:${EMAIL_COLORS.navy};vertical-align:top;">${H(field.value ?? "")}</td>
</tr>`,
    )
    .join("\n");
}

/**
 * The document strip under the header: the reference a student quotes on the
 * phone, when they submitted, and the programme they asked about.
 */
export function receiptBand(rows: { label: string; value: string; mono?: boolean }[]): string {
  return `<tr>
  <td bgcolor="${EMAIL_COLORS.cream}" class="mobile-pad" style="background-color:${EMAIL_COLORS.cream};border-bottom:1px solid ${EMAIL_COLORS.creamLine};padding:20px 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${rows
        .map(
          (row) => `<tr>
        <td class="band-cell" width="38%" valign="top" style="padding:0 14px 10px 0;font-family:${SANS};font-size:10px;line-height:15px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${EMAIL_COLORS.muted};">${H(row.label)}</td>
        <td class="band-cell" width="62%" valign="top" style="padding:0 0 10px 0;font-family:${row.mono ? MONO : SANS};font-size:${row.mono ? 17 : 14}px;line-height:23px;font-weight:${row.mono ? 700 : 600};letter-spacing:${row.mono ? "0.4px" : "0"};color:${EMAIL_COLORS.navy};">${H(row.value)}</td>
      </tr>`,
        )
        .join("\n      ")}
    </table>
  </td>
</tr>`;
}

interface Step {
  title: string;
  body: string;
}

/** A numbered "what happens next" list. */
export function stepList(steps: Step[]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  ${steps
    .map(
      (step, index) => `<tr>
    <td width="30" valign="top" style="padding:0 12px ${index === steps.length - 1 ? 0 : 18}px 0;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td width="26" height="26" align="center" valign="middle" bgcolor="${EMAIL_COLORS.navy}" style="width:26px;height:26px;background-color:${EMAIL_COLORS.navy};border-radius:13px;font-family:${SANS};font-size:12px;line-height:26px;font-weight:700;color:${EMAIL_COLORS.white};">${index + 1}</td>
        </tr>
      </table>
    </td>
    <td valign="top" style="padding:1px 0 ${index === steps.length - 1 ? 0 : 18}px 0;">
      <div style="font-family:${SERIF};font-size:16px;line-height:23px;font-weight:400;color:${EMAIL_COLORS.navy};">${H(step.title)}</div>
      <div style="margin-top:3px;font-family:${SANS};font-size:13.5px;line-height:21px;color:${EMAIL_COLORS.slate};">${H(step.body)}</div>
    </td>
  </tr>`,
    )
    .join("\n  ")}
</table>`;
}

/** One tile of the institutional facts grid. */
export function factCell(label: string, value: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${EMAIL_COLORS.white};border:1px solid ${EMAIL_COLORS.line};border-top:2px solid ${EMAIL_COLORS.steel};border-radius:6px;">
  <tr>
    <td style="padding:13px 15px 14px 15px;">
      <div style="font-family:${SANS};font-size:10px;line-height:15px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:${EMAIL_COLORS.muted};">${H(label)}</div>
      <div style="margin-top:4px;font-family:${SERIF};font-size:17px;line-height:24px;color:${EMAIL_COLORS.navy};">${H(value)}</div>
    </td>
  </tr>
</table>`;
}

/** Two-by-two grid of the tiles above, stacking on a phone. */
export function factGrid(cells: [string, string][]): string {
  const rows: string[] = [];
  for (let index = 0; index < cells.length; index += 2) {
    const pair = cells.slice(index, index + 2);
    rows.push(`<tr>
        ${pair
          .map(
            ([label, value], column) =>
              `<td class="stat-cell" width="50%" valign="top" style="padding:0 ${column === 0 ? 6 : 0}px 10px ${column === 0 ? 0 : 6}px;">${factCell(label, value)}</td>`,
          )
          .join("\n        ")}
      </tr>`);
  }
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${rows.join("\n      ")}
    </table>`;
}

/**
 * The brand band: a hairline, the institution lockup (crest *and* wordmark),
 * an academic-year eyebrow, the personalised greeting and one line of context.
 */
export function brandHeader(options: {
  logoUrl: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  logoWidth?: number;
}): string {
  // 262px is the lockup's own width: rendering it wider would only soften it.
  const { logoUrl, eyebrow: kicker, title, subtitle, logoWidth = 262 } = options;
  return `<tr><td height="5" bgcolor="#081d36" style="height:5px;font-size:0;line-height:0;background-color:#081d36;">&nbsp;</td></tr>
<tr>
  <td bgcolor="${EMAIL_COLORS.navyDeep}" class="mobile-pad" style="background-color:${EMAIL_COLORS.navyDeep};padding:30px 32px 32px 32px;text-align:center;">
    <img src="${H(logoUrl)}" class="brand-lockup" width="${logoWidth}" alt="Arundathi Institute of Medical Sciences and Hospital" style="display:block;margin:0 auto 22px auto;width:${logoWidth}px;max-width:82%;height:auto;border:0;outline:none;text-decoration:none;" />
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 16px auto;">
      <tr><td height="2" width="46" bgcolor="${EMAIL_COLORS.steel}" style="height:2px;width:46px;font-size:0;line-height:0;background-color:${EMAIL_COLORS.steel};">&nbsp;</td></tr>
    </table>
    <div style="font-family:${SANS};font-size:11px;line-height:16px;font-weight:700;letter-spacing:2.6px;text-transform:uppercase;color:${EMAIL_COLORS.sky};">${H(kicker)}</div>
    <h1 class="hero-title" style="margin:12px 0 10px 0;font-family:${SERIF};font-size:34px;line-height:42px;font-weight:400;color:${EMAIL_COLORS.white};letter-spacing:0.2px;">${H(title)}</h1>
    <p style="margin:0 auto;max-width:430px;font-family:${SANS};font-size:14.5px;line-height:22px;color:${ON_NAVY};">${H(subtitle)}</p>
  </td>
</tr>
${accentStrip()}`;
}

/** The same band for the internal notification: left-aligned, no greeting. */
export function internalHeader(options: {
  logoUrl: string;
  eyebrow: string;
  title: string;
  subtitle: string;
}): string {
  const { logoUrl, eyebrow: kicker, title, subtitle } = options;
  return `<tr><td height="5" bgcolor="#081d36" style="height:5px;font-size:0;line-height:0;background-color:#081d36;">&nbsp;</td></tr>
<tr>
  <td bgcolor="${EMAIL_COLORS.navyDeep}" class="mobile-pad" style="background-color:${EMAIL_COLORS.navyDeep};padding:26px 32px 28px 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td valign="middle"><img src="${H(logoUrl)}" width="186" alt="Arundathi Institute of Medical Sciences and Hospital" style="display:block;width:186px;max-width:70%;height:auto;border:0;" /></td>
        <td align="right" valign="middle" style="font-family:${SANS};font-size:10px;line-height:15px;font-weight:700;letter-spacing:1.7px;text-transform:uppercase;color:${EMAIL_COLORS.sky};">Admissions ${H(kicker)}</td>
      </tr>
    </table>
    <div style="margin-top:24px;font-family:${SANS};font-size:10px;line-height:15px;font-weight:700;letter-spacing:2.4px;text-transform:uppercase;color:${EMAIL_COLORS.steel};">Internal notification</div>
    <h1 class="internal-title" style="margin:8px 0 8px 0;font-family:${SERIF};font-size:30px;line-height:37px;font-weight:400;color:${EMAIL_COLORS.white};letter-spacing:0.2px;">${H(title)}</h1>
    <p style="margin:0;font-family:${SANS};font-size:14px;line-height:21px;color:${ON_NAVY};">${H(subtitle)}</p>
  </td>
</tr>
${accentStrip()}`;
}

/** Closing line, sign-off and the footer, in that order, on the navy band. */
export function emailFooter(options: {
  referenceId?: string;
  internal?: boolean;
}): string {
  const { referenceId, internal = false } = options;
  return `<tr>
  <td bgcolor="${EMAIL_COLORS.navyDeep}" class="mobile-pad" style="background-color:${EMAIL_COLORS.navyDeep};padding:30px 32px 26px 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td class="footer-cell" width="56%" valign="top" style="padding:0 18px 18px 0;">
          <div style="font-family:${SERIF};font-size:15px;line-height:22px;color:${EMAIL_COLORS.white};">Arundathi Institute of Medical Sciences and Hospital</div>
          <div style="margin-top:9px;font-family:${SANS};font-size:12px;line-height:19px;color:${ON_NAVY_DIM};">Beside MLRIT, Dundigal, Gandi Maisamma,<br />Medchal-Malkajgiri District, Telangana 500043</div>
        </td>
        <td class="footer-cell" width="44%" valign="top" style="padding:0 0 18px 0;">
          <div style="font-family:${SANS};font-size:10px;line-height:15px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${EMAIL_COLORS.steel};">Admissions office</div>
          <div style="margin-top:8px;font-family:${SANS};font-size:12px;line-height:22px;color:${ON_NAVY};">
            <a href="tel:+919000994842" style="color:${EMAIL_COLORS.ice};text-decoration:none;">+91 90009 94842</a><br />
            <a href="mailto:admissions@aims.ac.in" style="color:${EMAIL_COLORS.ice};text-decoration:none;">admissions@aims.ac.in</a><br />
            <a href="https://www.aims.ac.in/" style="color:${EMAIL_COLORS.ice};text-decoration:none;">aims.ac.in</a>
          </div>
          <div style="margin-top:8px;font-family:${SANS};font-size:11px;line-height:18px;color:${ON_NAVY_DIM};">Counselling code&nbsp;<strong style="color:${EMAIL_COLORS.white};">AIMD</strong></div>
        </td>
      </tr>
      <tr>
        <td colspan="2" style="padding-top:16px;border-top:1px solid ${EMAIL_COLORS.navySoft};font-family:${SANS};font-size:11px;line-height:18px;color:${EMAIL_COLORS.steel};">
          ${internal
      ? "This is an internal notification generated for the AIMS admissions team. It contains personal data; handle it in line with the institution&rsquo;s privacy policy."
      : "You received this email because you submitted an admissions enquiry on the official AIMS website. This is a transactional message about your enquiry."}
        </td>
      </tr>
      ${referenceId
      ? `<tr><td colspan="2" style="padding-top:10px;font-family:${MONO};font-size:11px;line-height:18px;color:${ON_NAVY_DIM};">Reference ID: ${H(referenceId)}</td></tr>`
      : ""}
    </table>
  </td>
</tr>`;
}
