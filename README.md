# AIMS Admissions 2026–27

Admissions enquiry website for **Arundathi Institute of Medical Sciences (AIMS)**, Dundigal, Telangana. A prospective student submits an enquiry; the server validates it, generates a reference ID, emails a personalized confirmation to the student, and emails a detailed notification to the admissions team.

Built with Next.js 16 (App Router), React 19, TypeScript, Zod, and Nodemailer over SMTP, authenticated with a mailbox app password.

---

## What is implemented

- AIMS-branded responsive landing page using the official AIMS logo and campus imagery, with a minimal card-based layout and all enquiry CTAs pointing to the dedicated form page.
- Four quick-link tiles under the hero — brochure, Instagram, admissions phone, campus map — plus a video section of four YouTube films about AIMS and the Arundathi Hospital.
- Dedicated `/enquire` page set over the Arundathi Hospital photograph, with the form on a blue glass-morphism surface, a submit loading overlay, and an animated confirmation (drawn checkmark, pulsing ring, staggered reveal) that scrolls itself into view and then returns the visitor to the home page after 10 seconds, on phones as well as desktops.
- Institutional facts limited to verified information: established 2023, KNRUHS affiliation, NMC approval, counselling code AIMD, Dundigal campus.
- Dedicated `/enquire` page with the admissions form: mandatory and optional medical-college-appropriate fields, client-side validation, server-side validation, and preserved values on failure.
- Two separately tracked transactional emails:
  - **Student confirmation** — personalized, includes the submitted details, reference ID, AIMS information, virtual tour link, and contact details.
  - **Admissions notification** — administrative layout with the full submission, submission time in IST, consent status, and Reply-To set to the student.
- Reference IDs formatted `AIMS-26-XXXXXX` (ambiguous characters excluded).
- Honeypot spam field, 16 KB request-size limit, per-IP rate limiting (5 enquiries / 10 minutes), a second address-independent ceiling (30 / 10 minutes) that survives forged forwarding headers, same-origin checks on browser submissions, and generic bot rejection.
- HTML escaping, header-value sanitization, and server-controlled recipients.
- Partial-failure handling: a success response is returned only when **both** email requests are accepted by the provider.
- Admin-protected retry endpoint that retries only the failed leg and never re-sends an accepted email.
- Every enquiry field is required and strictly typed: text fields reject markup characters, phone numbers must be 10-digit Indian mobiles, the programme must be one of the published departments, and interests must come from the published list — choosing "Others" also requires the candidate's own description, which is kept with their enquiry. The form is postgraduate-only: no undergraduate qualification, marks or NEET-UG fields are collected or recorded.
- **Brochure tile**: on a desktop browser the PDF opens in the browser's own viewer in a new tab; on phones and tablets the same tile hands the file to the device download manager (`download` attribute, same-origin) with the file size and page count shown before the tap. The web copy is 4.1 MB rather than the 21.6 MB source export, with images capped at 96 dpi and re-encoded at JPEG quality 82 (visually equivalent at reading size).
- **Video section**: click-to-play cards for four publicly embeddable YouTube videos, each opening an accessible modal (`role="dialog"`, focus trap, Escape and backdrop close, scroll lock) that loads the privacy-enhanced `youtube-nocookie.com` player and links back to YouTube. On phones the cards become a snap-scrolling row.
- Instagram profile linked from the network tile; the LinkedIn company page remains linked from the footer.
- 163 automated tests with the SMTP transport mocked and the GitHub dispatch stubbed.

## Project structure

```
app/
  layout.tsx                     Metadata, fonts, global styles
  page.tsx                       Landing page (headline, quick links, AIMS information)
  enquire/page.tsx               Dedicated admissions enquiry page
  globals.css                    Design system and responsive layout
  api/enquiries/route.ts         Enquiry submission endpoint
  api/admissions/retry/route.ts  Admin-only failed-leg retry
components/
  SiteHeader.tsx  SiteFooter.tsx  EnquiryForm.tsx
  BrochureTile.tsx               Brochure tile; opens on desktop, downloads on phones
  VideoWall.tsx                  Video cards and the click-to-play modal
lib/
  institution.ts                 Verified institutional facts and form options
  videos.ts                      YouTube videos about AIMS shown in the video section
  validation.ts                  Zod schema and normalization
  reference.ts                   Reference IDs and IST timestamps
  escape.ts                      HTML escaping and header sanitization
  rate-limit.ts                  In-memory fixed-window limiter
  enquiry-store.ts               In-memory delivery state for retries
  email/
    config.ts                    Server-side environment configuration
    provider.ts                  SMTP adapter (Nodemailer) with error mapping
    service.ts                   Independent student and admissions sends
    components.ts                Shared table-based email layout
    fields.ts                    Conditional field lists
    templates/
      student-confirmation.ts
      admissions-notification.ts
public/images/                   Official AIMS logo and campus imagery
public/images/videos/            Video card thumbnails (one per YouTube id)
public/documents/aims-brochure.pdf   Web copy of the institute brochure (16 pages, 4.1 MB)
tests/                           Vitest suite
```

## Setup

```bash
npm install
cp .env.example .env.local
# edit .env.local with real credentials
npm run dev
```

Open http://localhost:3000.

### Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `SMTP_USER` | Yes | Mailbox that sends both emails, e.g. `admissions@gmail.com`. Never expose with `NEXT_PUBLIC_`. |
| `SMTP_APP_PASSWORD` | Yes | App password for that mailbox. A normal account password will not work with Gmail, Outlook or Yahoo. |
| `SMTP_HOST` | Optional | Mail server host. Inferred for Gmail, Outlook/Hotmail/Live, Yahoo and Zoho; required for every other domain. |
| `SMTP_PORT` | Optional | Defaults to `465` for the built-in presets; use `587` for STARTTLS. |
| `SMTP_SECURE` | Optional | Implicit TLS. Defaults to `true` when the port is `465`. |
| `EMAIL_FROM` | Recommended | Sender shown to recipients, e.g. `AIMS Admissions <admissions@gmail.com>`. Defaults to `AIMS Admissions <SMTP_USER>`. |
| `ADMISSIONS_EMAIL` | Recommended | Internal recipient. Defaults to `admissions@aims.ac.in`. |
| `EMAIL_LOGO_URL` | Optional | HTTPS logo used in emails. Defaults to the official AIMS white logo. |
| `ADMIN_RETRY_TOKEN` | Optional | Bearer token enabling `/api/admissions/retry`. Endpoint is disabled when unset. |
| `SITE_URL` | Optional | Public site URL used for metadata. |

### Mailbox app-password setup

1. Pick the mailbox that will send both emails. It does not have to be on the `aims.ac.in` domain, but it must be a real mailbox you can sign in to.
2. Turn on two-step verification for that account, then generate an **app password**:
   - **Gmail** — Google Account → Security → 2-Step Verification → App passwords. No `SMTP_HOST` needed.
   - **Outlook / Microsoft 365** — Security → Advanced security options → App passwords. No `SMTP_HOST` needed. Microsoft may disable app passwords for some tenants; if so, SMTP AUTH must be enabled by the administrator.
   - **Zoho / Yahoo** — same idea, generated in account security settings.
3. Put the mailbox in `SMTP_USER` and the generated password in `SMTP_APP_PASSWORD`. Paste it exactly as shown; the spaces in a Gmail app password are part of the password.
4. For any other mail server, set `SMTP_HOST` (for example `mail.aims.ac.in`), plus `SMTP_PORT` and `SMTP_SECURE` if they differ from `465`/`true`.
5. Keep `EMAIL_FROM` on the same mailbox, or on an alias that server is allowed to send as. Gmail in particular rewrites a mismatched From to the authenticated account.
6. Set `ADMISSIONS_EMAIL=admissions@aims.ac.in`. This recipient is server-controlled and cannot be changed by the browser.

Restart the dev server after editing `.env.local`; Next.js only reads it at startup. A wrong or expired app password surfaces as `provider_auth_failed` in the server log and as a `502` to the visitor — never as a false success.

After deployment, it is recommended to host the email logo over HTTPS from the site itself and set:

```env
EMAIL_LOGO_URL=https://your-domain.example/images/aims-logo-email.png
```

The PNG in `public/images/` is included for this purpose (Outlook does not render WebP reliably).

### Logo assets

- `public/images/aims-emblem.png` — the crested AIMS emblem, rendered by the site header (34px) and footer (46px). Cropped to the ink on a transparent background, so it sits on the header tile, the white footer tile and any other surface without a pasted-in rectangle. Its long edge is about 90px: enough for those two slots, not enough for print or a hero — commission a larger master before using it at that size.
- `app/icon.png` and `app/apple-icon.png` are rendered from the same artwork.
- The email header uses the full institution lockup — crest *and* wordmark — through `EMAIL_LOGO_URL`, not this crest alone.

The assets it replaces were removed deliberately: `public/images/aims-emblem.svg` was an auto-trace of `aims-emblem.png`, and that raster was a clipped crop whose wreath was cut flat down its right edge, a defect the favicons inherited. `tests/assets.test.ts` now decodes the emblem and fails if its artwork is ever clipped again.

### Record enquiries in a Google Sheet

Every accepted enquiry can be appended to a spreadsheet as one row, columns defined by `SHEET_COLUMNS` in `lib/sheets.ts`. The ledger is independent of the emails: it runs alongside them, and if it is down the student still gets their confirmation and the submission still succeeds. Failures show up in the server log as `"event":"enquiry_recorded","spreadsheet":"failed"` with an error code, and the API response carries `recorded: "saved" | "skipped" | "failed"`.

Rows go in through an Apps Script web app, so the sheet is never shared with a third party and no service-account key is stored in the project.

1. Open the sheet, then **Extensions → Apps Script**. (A standalone script from script.new works too — the script opens the spreadsheet by ID, not by being bound to it.)
2. Replace the file contents with the script below. `SPREADSHEET_ID` already points at the admissions sheet; the Google account that deploys the script must have edit access to it. Set `SHARED_SECRET` to a long random string.
3. **Deploy → New deployment → Web app**, *Execute as* **Me**, *Who has access* **Anyone**. Copy the `/exec` URL.
4. In `.env.local`, set `SHEETS_WEBHOOK_URL` to that URL and `SHEETS_WEBHOOK_SECRET` to the same secret, then restart the dev server.

**The headings look after themselves.** On every enquiry the script compares the
tab with the column list the site just sent. If row 1 is different — a renamed
column — or the tab is wider than that list, which is what rows written under an
older layout leave behind, the whole tab is copied to a dated `Archive …` tab
first, cleared, and relabelled. Nothing is ever destroyed and no value is left
sitting under the wrong heading. `resetSheet` remains for running the same thing
by hand from the editor (**Extensions → Apps Script → Run**).

A row that never appears is nearly always a secret mismatch: `SHARED_SECRET` in the script and `SHEETS_WEBHOOK_SECRET` in `.env.local` must be identical character for character. The submission still succeeds for the student, but the response reports `recorded: "failed"` and the server log says `"spreadsheetError":"sheet_rejected"`. Changing the script needs a re-deploy (*Deploy → Manage deployments → Edit → Version: New version*) before the new value takes effect.

To check the two values agree without exposing either, open the `/exec` URL in a browser. The script answers with `{"ok":true,"secretSet":true,"secretFingerprint":"5f3c9a11","sheet":"Sheet1"}`, the first eight hex characters of the secret's SHA-256. Compare it with `printf %s "$SHEETS_WEBHOOK_SECRET" | sha256sum | cut -c1-8`; if they differ, the values cannot match and the secret line needs re-pasting. The secret itself is never returned.

The same deployment also relays the outgoing email, because Cloudflare Workers
have no raw sockets and therefore cannot speak SMTP. One `/exec` URL serves both.

```javascript
/**
 * AIMS admissions — record enquiries in the admissions spreadsheet and send the
 * two emails. The spreadsheet is opened by ID, so the script works whether it
 * lives in the sheet (Extensions → Apps Script) or on its own (script.new).
 */
const SPREADSHEET_ID = '1Uj1MIei1cUff6l519dPlA7jfAVL7Xc-KbVecidgCqFw';
const SHARED_SECRET = 'PASTE-A-LONG-RANDOM-STRING';
const SHEET_NAME = ''; // empty = the first tab of the spreadsheet
const SENDER_NAME = 'AIMS Admissions';
/** An enquiry is a few kilobytes; anything larger is not this form. */
const MAX_BODY_LENGTH = 64 * 1024;
/**
 * Mail is sent by a GitHub runner, not through this script. Leave the relay off
 * unless you deliberately use it: with it on, anyone who learns the secret can
 * send mail from this Gmail account. Set it to true only for the
 * EMAIL_WEBHOOK_URL transport.
 */
const ALLOW_MAIL_RELAY = false;

/**
 * The column headings, in the order the site writes them. Keep in step with
 * SHEET_COLUMNS in lib/sheets.ts; a test in this repository compares the two.
 */
const HEADER = [
  'Reference ID',
  'Submitted at (IST)',
  'Submitted at (ISO 8601)',
  'Student name',
  'Email address',
  'Mobile number',
  'Programme of interest',
  'Current city / district',
  'Current college / institution',
  'Areas of interest',
  'Academic or career goals',
  'Parent / guardian name',
  'Consent to be contacted',
  'Source',
];

/**
 * Copies the tab, contents and all, into a dated archive tab and empties it.
 * Nothing is destroyed: rows written under an older column list would otherwise
 * sit under the wrong headings, so they are preserved intact in the archive.
 */
function archiveAndClear(book, sheet) {
  if (sheet.getLastRow() > 0) {
    const stamp = Utilities.formatDate(
      new Date(),
      'Asia/Kolkata',
      'yyyy-MM-dd HH:mm:ss',
    );
    sheet.copyTo(book).setName('Archive ' + stamp);
  }
  sheet.clear();
}

/** Writes row 1 from the list the site sent, and keeps it visible while scrolling. */
function writeHeader(sheet, header) {
  const headings = sheet.getRange(1, 1, 1, header.length);
  headings.setValues([header]);
  headings.setFontWeight('bold');
  sheet.setFrozenRows(1);
}

/**
 * False when the tab holds anything the site's column list cannot describe:
 * more columns than headings (rows from an older layout), or a heading that no
 * longer matches. Either way the tab is archived and relabelled before the next
 * row is written, so a renamed column never shifts the values beneath it.
 */
function layoutMatches(sheet, header) {
  if (sheet.getLastRow() === 0) return false;
  if (sheet.getLastColumn() > header.length) return false;
  const current = sheet.getRange(1, 1, 1, header.length).getValues()[0];
  return header.every(
    (value, index) => String(current[index] || '') === value,
  );
}

/** The same reset, run by hand from the editor; the append path does it too. */
function resetSheet() {
  const book = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet =
    (SHEET_NAME && book.getSheetByName(SHEET_NAME)) || book.getSheets()[0];

  archiveAndClear(book, sheet);
  writeHeader(sheet, HEADER);
  return reply({ ok: true, columns: HEADER.length });
}

/**
 * `===` stops at the first wrong character, so response timing hints at how
 * much of a guess was right. This walks the whole value either way.
 */
function secretMatches(provided, expected) {
  const given = String(provided || '');
  if (given.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= given.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

/** Opening the /exec URL reports whether the deployment is live. */
function doGet() {
  try {
    const book = SpreadsheetApp.openById(SPREADSHEET_ID);
    return reply({
      ok: true,
      script: 'aims-admissions',
      spreadsheetId: SPREADSHEET_ID,
      secretSet: Boolean(SHARED_SECRET),
      // A fingerprint, not the secret and not its length: enough to check that
      // the value matches, useless to anyone who intercepts it.
      secretFingerprint: Utilities.computeDigest(
        Utilities.DigestAlgorithm.SHA_256,
        SHARED_SECRET,
      )
        .slice(0, 4)
        .map((byte) => (byte & 0xff).toString(16).padStart(2, '0'))
        .join(''),
      sheet: book ? book.getName() : '(not bound to a spreadsheet)',
      mailQuotaRemaining: MailApp.getRemainingDailyQuota(),
    });
  } catch (error) {
    return reply({ ok: false, error: String(error) });
  }
}

function doPost(e) {
  try {
    const contents = e && e.postData ? e.postData.contents : '';
    if (typeof contents !== 'string' || contents.length > MAX_BODY_LENGTH) {
      return reply({ ok: false, error: 'payload too large' });
    }
    const body = JSON.parse(contents);
    // Fail closed: a deployment with no secret set accepts nothing at all.
    if (!SHARED_SECRET || !secretMatches(body.token, SHARED_SECRET)) {
      return reply({ ok: false, error: 'unauthorised' });
    }
    if (body.mail) {
      if (!ALLOW_MAIL_RELAY) {
        return reply({ ok: false, error: 'mail relay disabled' });
      }
      return sendMail(body.mail);
    }
    return appendRow(body);
  } catch (error) {
    return reply({ ok: false, error: String(error) });
  }
}

/**
 * Sends one prepared message from this Google account. This is what the Worker
 * calls instead of SMTP. Quota is the account's own: 100 recipients a day on
 * consumer Gmail, 1500 on Google Workspace.
 */
/** One bare address; anything carrying angles, commas or newlines is refused. */
function address(value) {
  return typeof value === 'string' &&
    /^[^\s<>,;"]+@[^\s<>,;"]+\.[^\s<>,;"]+$/.test(value)
    ? value
    : '';
}

function sendMail(mail) {
  const to = mail ? address(mail.to) : '';
  const replyTo = mail && mail.replyTo ? address(mail.replyTo) : '';
  if (!to || !mail.subject) {
    return reply({ ok: false, error: 'malformed mail' });
  }
  if (mail.replyTo && !replyTo) {
    // A header smuggled in through the recipient is refused outright.
    return reply({ ok: false, error: 'malformed mail' });
  }
  try {
    MailApp.sendEmail(to, mail.subject, mail.text || '', {
      name: SENDER_NAME,
      htmlBody: mail.html,
      ...(replyTo ? { replyTo: replyTo } : {}),
    });
    return reply({ ok: true, id: 'relay-' + Date.now() });
  } catch (error) {
    return reply({ ok: false, error: String(error) });
  }
}

function appendRow(body) {
  if (
    !Array.isArray(body.header) ||
    !Array.isArray(body.values) ||
    body.header.length !== body.values.length
  ) {
    return reply({ ok: false, error: 'malformed payload' });
  }

  // Two enquiries can land together; without a lock their rows can interleave.
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) {
    return reply({ ok: false, error: 'busy' });
  }

  try {
    const book = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet =
      (SHEET_NAME && book.getSheetByName(SHEET_NAME)) || book.getSheets()[0];

    // The column list lives in the site's code, so the tab follows it. A tab
    // written under an older list is archived first, then relabelled, so no
    // value is ever left under the wrong heading.
    if (!layoutMatches(sheet, body.header)) {
      archiveAndClear(book, sheet);
      writeHeader(sheet, body.header);
    }

    // Sheets evaluates a cell starting with =, +, - or @ as a formula, which is
    // how "+91 98765 43210" turns into #ERROR!. Format those cells as text.
    const range = sheet.getRange(sheet.getLastRow() + 1, 1, 1, body.values.length);
    body.values.forEach((value, index) => {
      if (/^[=+\-@]/.test(String(value))) {
        range.getCell(1, index + 1).setNumberFormat('@');
      }
    });
    range.setValues([body.values]);

    return reply({ ok: true, row: sheet.getLastRow() });
  } finally {
    lock.releaseLock();
  }
}

function reply(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
```

Adding `MailApp` asks for one extra authorisation (*See, edit, create and delete
your email*) the next time you deploy, and the `/exec` URL must be re-deployed as
a new version before the mail function exists. `doGet` reports
`mailQuotaRemaining` so you can see how much of the day's allowance is left.

The deployed site uses `SHEETS_WEBHOOK_URL` and `SHEETS_WEBHOOK_SECRET` for rows.
For mail, see "Mail sent by a GitHub Actions runner" below — that is the path the
live site uses. The alternatives are Brevo (`BREVO_API_KEY`) and an Apps Script
relay (`EMAIL_WEBHOOK_URL`, the same `/exec` URL and secret, with
`ALLOW_MAIL_RELAY = true` in the script), and plain SMTP,
which only works on a Node host: a Worker has no raw sockets. `EMAIL_TRANSPORT`
forces one of the four (`github`, `brevo`, `webhook`, `smtp`); otherwise a
dispatch token wins, then a Brevo key, then a relay URL, then SMTP.

Every row carries the reference ID, the time in IST, the full submission, and `Source`. The mobile number is written as `91 98765 43210` rather than `+91 98765 43210`, because Sheets would read the leading `+` as a formula and show `#ERROR!` in the cell; the confirmation emails still show the `+` form. `SHEET_COLUMNS` is the single source of truth for the header: the script archives and relabels whenever row 1 differs or the tab is wider than the column list, so adding, removing or renaming a column leaves nothing under the wrong heading on the next enquiry. Re-deploying the script (*Deploy → Manage deployments → Edit → Version: New version*) is required after editing it.

## Deploy to Cloudflare Pages

The site is a static export served by Cloudflare Pages, with the two endpoints in
`functions/` running as Pages Functions (Workers underneath). The project is
`qr-aims`, so production is **https://qr-aims.pages.dev**.

```bash
npm run build     # static export to out/, SITE_URL pinned to the production URL
npm run preview   # build, then serve out/ locally with the Functions attached
npm run deploy    # build, then upload a production deployment
```

`next dev` still serves the pages, but it has no API to post to — the handlers
live in `functions/`, not in `app/api`. Use `npm run preview` when you need the
form to work locally.

`SITE_URL` and `ADMISSIONS_EMAIL` are plain variables in `wrangler.toml`. The
four Google-side values are project secrets, and a secret only reaches the site
through a **new deployment** — set them, then redeploy:

```bash
npx wrangler pages secret put SHEETS_WEBHOOK_URL --project-name qr-aims
npx wrangler pages secret put SHEETS_WEBHOOK_SECRET --project-name qr-aims
npx wrangler pages secret put GITHUB_DISPATCH_TOKEN --project-name qr-aims
npx wrangler pages secret put MAIL_PAYLOAD_KEY --project-name qr-aims
```

Without a mail secret the site sends nothing, the form answers `503`, and the
student is shown the helpline message; new secrets only take effect on the next
`npm run deploy`.

### Mail sent by a GitHub Actions runner

A Worker cannot open an SMTP connection, and this site has no domain to verify
with a mail vendor. A GitHub Actions runner has both real sockets and the
mailbox credentials already in use here, so the send happens there:

1. The student submits the form. The Function seals the enquiry with AES-256-GCM
   under `MAIL_PAYLOAD_KEY` and dispatches
   `.github/workflows/send-enquiry-mail.yml` in
   **[aims-form-automation](https://github.com/Needless64/aims-form-automation)**.
2. The runner opens the payload and sends both emails over SMTP, using the same
   templates under `lib/email/` that the site renders locally.

That repository is **public**, which is why the payload is sealed: a
`workflow_dispatch` run and its inputs are readable by anyone, and student names,
numbers and email addresses are not ours to publish. Nothing in the run prints
the enquiry — only its reference ID and the outcome of each leg.

Set-up, once:

```bash
# In the repository: Settings → Secrets and variables → Actions
#   MAIL_PAYLOAD_KEY     same value as the Pages secret below
#   SMTP_USER            the sending mailbox
#   SMTP_APP_PASSWORD    its app password
#   SMTP_HOST, SMTP_PORT, ADMISSIONS_EMAIL, EMAIL_LOGO_URL   (optional)

# On the Pages project
openssl rand -base64 32           # MAIL_PAYLOAD_KEY — the same value in both places
npx wrangler pages secret put MAIL_PAYLOAD_KEY --project-name qr-aims
npx wrangler pages secret put GITHUB_DISPATCH_TOKEN --project-name qr-aims
npm run deploy
```

`GITHUB_DISPATCH_REPO` is `owner/aims-form-automation`, `GITHUB_DISPATCH_REF`
defaults to `main`, and `GITHUB_DISPATCH_WORKFLOW` to `send-enquiry-mail.yml`. To
dispatch, `GITHUB_DISPATCH_TOKEN` must be a **fine-grained** token for that one
repository with *Actions: read and write* — not a classic token, which would
grant access to every repository you own.

The site reports `queued`, not `accepted`, for both legs: once the job is
handed over, nothing on the site ever sees the message delivered. A runner that
fails shows as a red run in the repository, and the enquiry is still in the
spreadsheet. Rotating the app password means updating `SMTP_APP_PASSWORD` in the
repository and nothing else; changing `MAIL_PAYLOAD_KEY` means updating it in
both places, since a mismatch leaves the runner unable to open the payload.

### Mail from a site that has no domain (alternative)

A verified sender address is enough for [Brevo](https://www.brevo.com), so this
works without a domain of your own. In the Brevo dashboard: add and verify the
address you will send from (*Senders*), then create a key (*SMTP & API → API
keys*).

```bash
npx wrangler pages secret put BREVO_API_KEY --project-name qr-aims
npx wrangler pages secret put EMAIL_FROM --project-name qr-aims   # "AIMS Admissions <verified-address@example.com>"
npm run deploy
```

Any address in `EMAIL_FROM` other than the verified sender is rejected by the
provider, and the form then reports `502` with the failing leg named.
Brevo's free tier covers the 300 messages a day this form needs. Set this up
only if you would rather not send from a runner; clear `GITHUB_DISPATCH_TOKEN`
for the site to fall back to it.

For `npm run preview`, the same values go in `.dev.vars` (gitignored).

A Pages Function is not one long-running process: the rate limiter and the retry
store live in memory per isolate, so the 5-per-10-minutes limit and
`POST /api/admissions/retry` are best-effort on the deployed site and exact on a
single Node instance. Entries in the spreadsheet remain the durable record.

There is no Next.js server in this setup, so `next/image` runs with
`unoptimized: true` and the security headers live in `public/_headers` rather
than `next.config.ts`.

## API

### `POST /api/enquiries`

Accepts `application/json` only, maximum 16 KB.

Required: `fullName` (2–100 letters, spaces, hyphens, apostrophes), `email`, `phone` (10-digit Indian mobile, `+91`/leading zero accepted and normalised), `programme` (one of the published departments), `city` (2–80), `currentCollege` (2–120), `interests` (at least one listed area), `interestOther` (2–80 characters, required only when `interests` includes `"Others"`), `goals` (10–600 characters), `parentName` (2–100), and `consent` (must be the boolean `true`).
Honeypot: `companyWebsite` must be empty.
Origin: a browser POST whose `Origin` host differs from the request host is refused with `403` before it can spend a rate-limit slot.
The undergraduate fields the form no longer asks for — `qualification`, `marks`, `neetStatus`, `neetScore`, and the old `course` key — are ignored if a stale client still sends them, so only the fields above are validated, emailed and recorded.

Every field is a string or boolean of the declared type; numeric JSON values, arrays where a string is expected, unknown enum values, and markup characters in name/place fields are rejected with `422`.

Each leg reports `accepted` (the provider took the message), `queued` (the job
was handed to the GitHub runner — see above) or `failed`.

Success (`200`) only when neither leg failed:

```json
{
  "ok": true,
  "referenceId": "AIMS-26-AB7K9Q",
  "submittedAt": "2026-10-27T13:12:00.000Z",
  "timeLabel": "27 October 2026, 6:42 PM IST",
  "deliveries": { "student": "queued", "admissions": "queued" }
}
```

Validation failure: `422` with `fieldErrors`.
Rate limited: `429` with `Retry-After`.
Provider partially or fully failed: `502` with `ok: false`, `partial`, `referenceId`, and per-leg statuses. **No success message is shown in this case.**
Email not configured: `503`.
Oversized or non-JSON bodies: `413` / `415`.

### `POST /api/admissions/retry` (staff only)

Requires `Authorization: Bearer $ADMIN_RETRY_TOKEN` and body `{ "referenceId": "AIMS-26-ABCDEF" }`. Only a leg the provider already **accepted** is skipped, so a leg reported as `queued` is sent again — with the runner transport that re-dispatches the whole job, which is the way to recover when a student says nothing arrived. A repeated retry can therefore deliver a second copy.

```bash
curl -X POST https://your-domain.example/api/admissions/retry \
  -H "Authorization: Bearer $ADMIN_RETRY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"referenceId":"AIMS-26-AB7K9Q"}'
```

Only legs that failed are sent. If both emails were already accepted, the endpoint returns `409` and sends nothing. Records expire after 48 hours.

## Testing

```bash
npm test          # 163 tests, SMTP transport mocked
npm run lint      # tsc --noEmit
npm run build     # production build
```

The suite covers validation (every field required, strict types, invalid email/phone, unlisted departments and interests, markup rejection, normalization, dropped UG fields), SMTP configuration presets and failures, reference generation and IST timestamps, HTML escaping and header injection, both templates (recipient content, conditional fields, consistent reference IDs, mobile/table structure, plain-text alternatives), provider request shape and error mapping, student/admissions recipient correctness, Reply-To, both-email success, each single-leg failure, total failure, duplicate retry prevention, rate limiting, honeypot rejection, size limits, and missing email configuration.

No automated test opens an SMTP connection or sends mail to `admissions@aims.ac.in`; Nodemailer's transport is replaced with a mock.

Both pages were also reviewed in Chrome at 1440 px, 834 px and 390 px widths: no horizontal overflow, all form controls have associated labels, and the mobile layout stacks the enquiry form ahead of the contact sidebar.

### Authorized end-to-end test

Only after the sending mailbox is configured:

1. Set `SMTP_USER`, `SMTP_APP_PASSWORD`, `EMAIL_FROM`, `ADMISSIONS_EMAIL`, and (optionally) `EMAIL_LOGO_URL` in `.env.local`.
2. Start the app with `npm run dev`.
3. Submit one enquiry using a **test student email address you control** (for example, `you+aims-test@your-domain.example`). Do not use a real applicant's address.
4. Confirm the student inbox received the confirmation and the admissions inbox received the notification.
5. Verify both messages show the same reference ID and that Reply-To on the internal email is the student test address.
6. If you intentionally simulate a failure, use the retry endpoint with the same reference ID and confirm only the failed leg is sent.

## Reliability notes and limitations

- **No database or durable queue.** Delivery status is kept in memory for 48 hours so the retry endpoint can avoid duplicate sends. A server restart, a second instance, or a serverless cold start loses this state. For production durability, persist enquiries and per-leg delivery states in a database (with a unique reference ID) and/or process failures through a queue. The current design intentionally avoids introducing infrastructure the project does not have.
- **Rate limiting and the enquiry store are per instance.** Multi-instance deployments need a shared store (e.g. Redis or the database above). The per-address bucket keys on `cf-connecting-ip` — set and overwritten by Cloudflare, so it cannot be forged — then `x-real-ip`, and only last on `x-forwarded-for`; the address-independent ceiling applies whatever the header says.
- **Server acceptance is not inbox delivery.** A successful SMTP handshake means the mail server took responsibility for the message, not that it reached the inbox or survived spam filtering. Consumer mailboxes (Gmail in particular) also cap how many messages a single account can send per day, and messages sent from a personal address look less trustworthy than a domain with SPF/DKIM/DMARC. No delivery guarantee is claimed in the UI or emails.
- **An app password is a long-lived credential.** It grants full send access to that mailbox and is stored in the server environment. Use a dedicated mailbox rather than a personal account, keep `.env.local` out of version control, and revoke the password if the deployment is ever exposed.
- **Retry after a partial failure is staff-initiated**, not available to the student, because resubmitting the form could duplicate the email leg that already succeeded.
- The in-memory store contains personal data for 48 hours in process memory. Logs contain the reference ID and per-leg statuses only — no name, email, phone, or message bodies.
- Email templates use table layouts, inline CSS, and mobile media queries. Dark-mode rendering varies by client; content remains readable.
- **The brochure is a web-optimized copy.** `public/documents/aims-brochure.pdf` was produced from the 21.6 MB source export by capping embedded images at 96 dpi and re-encoding at JPEG quality 82, which keeps the pages visually equivalent at reading size while cutting the download to 4.1 MB. Replace it and the tile still works; update `BROCHURE.pages`/`sizeLabel` in `lib/institution.ts` (a test asserts they match the file).
- **Video playback is third-party.** The modal loads the YouTube player from `youtube-nocookie.com`, so it needs network access and is subject to YouTube's embed and regional rules. Thumbnails are stored locally, so the section still looks right if the player is blocked.
- **Deployed** at https://qr-aims.pages.dev on Cloudflare Pages, with the mail sent by the runner in `Needless64/aims-form-automation`.

## Security

- **In transit.** The site is HTTPS-only and now sends HSTS, a strict CSP (`default-src 'self'`, only `youtube-nocookie.com` framed), `frame-ancestors 'none'`, `nosniff` and a restrictive `Permissions-Policy`. SMTP runs with implicit TLS on 465, or with `requireTLS` on a STARTTLS port so it can never fall back to plaintext. Every outbound API call (GitHub, Sheets, Brevo) is HTTPS, and the Sheets and webhook endpoints are rejected at configuration time if they are not.
- **Student data on the wire.** A dispatched enquiry is sealed with AES-256-GCM under `MAIL_PAYLOAD_KEY`, with a random IV per message and `aims-enquiry-v1` bound as additional data so a token cannot be replayed into another purpose. The workflow input, and therefore the public run page, contains only ciphertext.
- **Student data at rest.** It lives in process memory for 48 hours so a failed leg can be retried, and in the college's own Google Sheet. No third-party CRM, mail vendor or analytics service receives it on the live path.
- **The public API.** `POST /api/enquiries` caps the body at 16 KB, requires JSON, applies a honeypot, validates against a strict schema, refuses a browser `Origin` that is not the site itself, and answers with `Cache-Control: no-store` plus `nosniff` so no proxy can replay one student's reference to another. Only the reference ID and per-leg statuses are returned; configuration errors are logged internally and shown to the visitor as a generic message.
- **The Apps Script.** Compares the shared secret in constant time, fails closed when no secret is set, caps the body at 64 KB, finger­prints the secret instead of revealing it or its length, locks the sheet while appending, refuses recipient values that could smuggle headers, and keeps the mail relay off by default — the runner sends the mail.
- **Credentials.** `.env`, `.dev.vars` and `.env.local` are gitignored; the Pages secrets and repository secrets are the only copies, and the repo token is fine-grained with Actions only. Rotating the app password touches one repository secret; rotating `MAIL_PAYLOAD_KEY` touches both places; rotating `SHEETS_WEBHOOK_SECRET` touches the Pages project and the Apps Script.
- **Residual risk.** The rate limiter is per isolate, so a determined flood is bounded rather than stopped; the fine-grained GitHub token should be narrowed to this one repository; and the GitHub run log is public, which is why the payload is sealed and the runner prints only a reference ID.

## Content sources

- Institutional identity, logo, campus and hospital imagery: https://www.aims.ac.in/
- Counselling code AIMD, admissions phone `9000994842`, and `admissions@aims.ac.in`: supplied admissions details for 2026–27.
- Programme list: AIMS admits postgraduate medical students, so the enquiry form offers the thirteen departments published by the institution (General Medicine through Pathology). No fees, seat counts, rankings, placements, scholarships, or facilities claims were invented.
- Instagram profile: https://www.instagram.com/aimsmedicalcollege/
- LinkedIn company page: https://www.linkedin.com/company/arundathi-institute-of-medical-sciences/
- Brochure PDF: supplied institute brochure (source export `aims-brochure.pdf`), published under `/documents/aims-brochure.pdf`.
- Videos in the "Arundathi, on video" section are third-party coverage, credited on each card and never restated as AIMS claims:
  - `UmqXB4K0QdU` — "Arundathi Institute of Medical Sciences Telangana | MBBS Admission 2026 | Fees, Cutoff & Counselling", Admission Today.
  - `gU26HOKj-ZM` — "Arundhathi Institute of Medical Sciences Medchal | Closing Ranks, Fees, Courses, Intake & Facilities", Edu9 Career Guidance.
  - `0H5OlGSFYlg` — "Arundhati Hospital | Gandimaisamma | Dundigal | Hyderabad", Sathya Talkies.
  - `nztWgq0ORUM` — "Arundathi Hospital In Hyderabad Offers Free Treatment To Everyone", Telangana Today.
