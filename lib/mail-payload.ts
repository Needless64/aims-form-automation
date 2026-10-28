// The runner that sends the mail lives in a public repository, so the enquiry
// cannot travel in clear text: a dispatch input and its run are world-readable,
// and student names, phone numbers and email addresses are not ours to publish.
// The site seals the payload with a shared key and the runner opens it.
//
// Only WebCrypto is used, so the same code runs in a Worker and on Node.
import { enquirySchema, type Enquiry } from "@/lib/validation";

/** Exactly what the runner needs to rebuild both emails. */
export interface MailPayload {
  referenceId: string;
  /** ISO 8601; the runner formats it in IST like the site does. */
  submittedAt: string;
  enquiry: Enquiry;
}

export type MailPayloadErrorCode =
  | "key_invalid"
  | "payload_malformed"
  | "payload_invalid";

export class MailPayloadError extends Error {
  readonly code: MailPayloadErrorCode;

  constructor(code: MailPayloadErrorCode, message: string) {
    super(message);
    this.name = "MailPayloadError";
    this.code = code;
  }
}

const KEY_BYTES = 32;
const IV_BYTES = 12;
/** Bound into the ciphertext, so a sealed payload cannot be replayed elsewhere. */
const ADDITIONAL_DATA = "aims-enquiry-v1";
const REFERENCE_PATTERN = /^AIMS-\d{2}-[A-Z2-9]{6}$/;

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string, code: MailPayloadErrorCode): Uint8Array {
  try {
    const normalised = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalised.padEnd(Math.ceil(normalised.length / 4) * 4, "=");
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch {
    throw new MailPayloadError(code, "The value is not valid base64.");
  }
}

function decodeKey(key: string): Uint8Array {
  const trimmed = key.trim();
  if (!trimmed) {
    throw new MailPayloadError(
      "key_invalid",
      "MAIL_PAYLOAD_KEY is not configured.",
    );
  }
  const bytes = fromBase64Url(trimmed, "key_invalid");
  if (bytes.length !== KEY_BYTES) {
    throw new MailPayloadError(
      "key_invalid",
      `MAIL_PAYLOAD_KEY must decode to ${KEY_BYTES} bytes.`,
    );
  }
  return bytes;
}

async function importKey(
  raw: Uint8Array,
  usage: "encrypt" | "decrypt",
): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", raw as BufferSource, "AES-GCM", false, [
    usage,
  ]);
}

/** A fresh 32-byte key, base64 encoded — for the one-time shared-key setup. */
export function generateMailPayloadKey(): string {
  const bytes = new Uint8Array(KEY_BYTES);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

/**
 * Fails loudly when the configured key is unusable, so a misconfiguration is
 * caught while reading the environment rather than one enquiry at a time.
 */
export function assertMailPayloadKey(key: string): void {
  decodeKey(key);
}

/** Seals the enquiry into a single URL-safe token to dispatch to the runner. */
export async function sealMailPayload(
  payload: MailPayload,
  key: string,
): Promise<string> {
  const keyBytes = decodeKey(key);
  const iv = new Uint8Array(IV_BYTES);
  crypto.getRandomValues(iv);

  const cipher = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv as BufferSource,
      additionalData: encoder.encode(ADDITIONAL_DATA),
    },
    await importKey(keyBytes, "encrypt"),
    encoder.encode(JSON.stringify(payload)),
  );

  const sealed = new Uint8Array(IV_BYTES + cipher.byteLength);
  sealed.set(iv, 0);
  sealed.set(new Uint8Array(cipher), IV_BYTES);
  return toBase64Url(sealed);
}

/**
 * Opens a sealed token and validates it. A tampered token, a wrong key and a
 * malformed payload are all refused rather than half-trusted: the runner never
 * sends mail built from data it has not checked.
 */
export async function openMailPayload(
  token: string,
  key: string,
): Promise<MailPayload> {
  const keyBytes = decodeKey(key);
  const sealed = fromBase64Url(token.trim(), "payload_malformed");
  if (sealed.length <= IV_BYTES) {
    throw new MailPayloadError("payload_malformed", "The payload is truncated.");
  }

  let plaintext: ArrayBuffer;
  try {
    plaintext = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: sealed.slice(0, IV_BYTES) as BufferSource,
        additionalData: encoder.encode(ADDITIONAL_DATA),
      },
      await importKey(keyBytes, "decrypt"),
      sealed.slice(IV_BYTES) as BufferSource,
    );
  } catch {
    // Wrong key, tampered ciphertext or a token from a different deployment.
    throw new MailPayloadError(
      "payload_malformed",
      "The payload could not be opened with this key.",
    );
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(new TextDecoder().decode(plaintext));
  } catch {
    throw new MailPayloadError("payload_invalid", "The payload is not JSON.");
  }

  const candidate = decoded as Partial<MailPayload> | null;
  const referenceId =
    typeof candidate?.referenceId === "string" ? candidate.referenceId : "";
  const submittedAt =
    typeof candidate?.submittedAt === "string" ? candidate.submittedAt : "";
  const submitted = new Date(submittedAt);
  if (!REFERENCE_PATTERN.test(referenceId) || Number.isNaN(submitted.valueOf())) {
    throw new MailPayloadError(
      "payload_invalid",
      "The payload is missing its reference ID or submission time.",
    );
  }

  const enquiry = enquirySchema.safeParse(candidate?.enquiry);
  if (!enquiry.success) {
    throw new MailPayloadError(
      "payload_invalid",
      "The payload does not contain a valid enquiry.",
    );
  }

  return { referenceId, submittedAt, enquiry: enquiry.data };
}
