const HTML_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Escape every user-provided value before it is interpolated into an email. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => HTML_ENTITIES[character]);
}

/**
 * Remove CR/LF and control characters from values used in email headers,
 * preventing header injection. Length is capped defensively.
 */
export function sanitizeHeaderValue(value: string, maxLength = 120): string {
  return value
    .replace(/[\r\n\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}
