export function json(
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      // An enquiry response names a real student's reference, and a shared
      // proxy that stored it would hand it to the next visitor.
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
      Pragma: "no-cache",
      // The body is JSON, never a document: nothing here may be sniffed into
      // HTML, framed, or followed as a referrer.
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "X-Frame-Options": "DENY",
      "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
      ...init.headers,
    },
  });
}

/**
 * The caller's address, used only to bucket rate limits. Cloudflare sets
 * `cf-connecting-ip` at its edge and overwrites whatever the client sent, so it
 * is the one header that cannot be forged; `x-forwarded-for` is entirely
 * client-controlled and is kept only as a last resort for other runtimes.
 */
export function clientIp(request: Request): string {
  const edge = request.headers.get("cf-connecting-ip")?.trim();
  if (edge) return edge;

  const real = request.headers.get("x-real-ip")?.trim();
  if (real) return real;

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";

  return "unknown";
}
