/**
 * Pages hands the handler every binding, including non-string ones. The
 * configuration code only understands plain strings, so pass those through and
 * drop the rest.
 */
export function stringEnv(env: Record<string, unknown> | undefined) {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(env ?? {})) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

export interface PagesContext {
  request: Request;
  env: Record<string, unknown>;
}
