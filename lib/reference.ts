const REFERENCE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const istDate = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const istTime = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

/**
 * Human-readable, non-sequential reference: AIMS-26-XXXXXX.
 * Ambiguous characters (0/O, 1/I) are excluded so staff can read it aloud.
 */
export function generateReferenceId(now: Date = new Date()): string {
  const year = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "2-digit",
  }).format(now);
  // Web Crypto, so this runs identically on Node and on Workers.
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  let suffix = "";
  for (const byte of bytes) {
    suffix += REFERENCE_ALPHABET[byte % REFERENCE_ALPHABET.length];
  }
  return `AIMS-${year}-${suffix}`;
}

/** "27 October 2026, 6:42 pm IST" — consistent in emails and the UI. */
export function formatSubmissionTime(date: Date = new Date()): string {
  const time = istTime.format(date).replace(/\b(am|pm)\b/i, (m) =>
    m.toUpperCase(),
  );
  return `${istDate.format(date)}, ${time} IST`;
}

export function subjectTimestamp(date: Date = new Date()): string {
  return formatSubmissionTime(date);
}
