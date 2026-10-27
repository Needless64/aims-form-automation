/**
 * The configuration a request needs, shaped the same way in both runtimes:
 * Node's `process.env` or a Cloudflare Worker's string bindings.
 */
export type ServerEnv = Record<string, string | undefined>;
