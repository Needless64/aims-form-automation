import { z } from "zod";
import { DEPARTMENTS } from "@/lib/institution";

export const HONEYPOT_FIELD = "companyWebsite";

const CONTROL_CHARS = /[\u0000-\u0009\u000b-\u001f\u007f]/;

interface TextOptions {
  label: string;
  max: number;
  min?: number;
  pattern?: RegExp;
  patternError?: string;
  allowNewlines?: boolean;
}

/**
 * Required free text. Values must be strings, are trimmed, and are rejected
 * when they contain control characters or characters the field does not allow.
 */
function requiredText({
  label,
  max,
  min = 2,
  pattern,
  patternError,
  allowNewlines = false,
}: TextOptions) {
  const controlChars = allowNewlines
    ? /[\u0000-\u0009\u000b-\u001f\u007f]/
    : CONTROL_CHARS;

  return z
    .string({ error: `Please enter ${label}.` })
    .trim()
    .min(min, { error: `Please enter ${label}.` })
    .max(max, {
      error: `${label.charAt(0).toUpperCase()}${label.slice(1)} must be ${max} characters or fewer.`,
    })
    .refine((value) => !controlChars.test(value), {
      error: `${label.charAt(0).toUpperCase()}${label.slice(1)} contains invalid characters.`,
    })
    .refine(
      (value) => !pattern || pattern.test(value),
      { error: patternError ?? `Please enter a valid ${label}.` },
    )
    .transform((value) => value.replace(/[ \t]+/g, " ").trim());
}

const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M} .'-]*$/u;
const PLACE_PATTERN = /^[\p{L}\p{M}\d][\p{L}\p{M}\d .,'&()/-]*$/u;

function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits;
}

const nameField = (label: string, max = 100) =>
  requiredText({
    label,
    max,
    pattern: NAME_PATTERN,
    patternError:
      "Use letters, spaces, hyphens and apostrophes only.",
  });

const emailField = z
  .string({ error: "Please enter a valid email address." })
  .trim()
  .max(254, { error: "Email address is too long." })
  .transform((value) => value.toLowerCase())
  .pipe(z.email({ error: "Please enter a valid email address." }));

const phoneField = z
  .string({ error: "Please enter a valid mobile number." })
  .trim()
  .max(20, { error: "Please enter a valid mobile number." })
  .transform(normalizePhone)
  .pipe(
    z
      .string()
      .regex(/^[6-9]\d{9}$/, {
        error: "Enter a valid 10-digit Indian mobile number.",
      }),
  );

/**
 * A second phone number is a convenience, not a condition of enquiry: absent or
 * blank is accepted, but anything typed must be a real Indian mobile number.
 */
const optionalPhoneField = z
  .string({ error: "Please enter a valid mobile number." })
  .trim()
  .max(20, { error: "Please enter a valid mobile number." })
  .optional()
  .transform((value) => (value ? normalizePhone(value) : ""))
  .refine((value) => value === "" || /^[6-9]\d{9}$/.test(value), {
    error: "Enter a valid 10-digit Indian mobile number.",
  });

export const enquirySchema = z
  .object({
    fullName: nameField("the student's full name"),
    email: emailField,
    phone: phoneField,
    departments: z
      .array(z.enum(DEPARTMENTS, { error: "Select a valid department." }), {
        error: "Select at least one department.",
      })
      .min(1, { error: "Select at least one department." })
      .max(DEPARTMENTS.length, {
        error: "Select only the listed departments.",
      }),
    city: requiredText({
      label: "your current city or district",
      max: 80,
      pattern: PLACE_PATTERN,
      patternError: "Use letters, spaces, hyphens and parentheses only.",
    }),
    currentCollege: requiredText({
      label: "your current college or institution",
      max: 120,
      pattern: PLACE_PATTERN,
      patternError: "Enter a valid college or institution name.",
    }),
    /**
     * A candidate may leave this blank — not everyone has a plan in words yet —
     * but anything written is still capped and checked for control characters.
     */
    goals: z
      .string({ error: "Please describe your academic or career goals." })
      .trim()
      .max(600, {
        error: "Academic or career goals must be 600 characters or fewer.",
      })
      .refine(
        (value) => !/[\u0000-\u0008\u000b-\u001f\u007f]/.test(value),
        { error: "Academic or career goals contain invalid characters." },
      )
      .transform((value) => value.replace(/[ \t]+/g, " "))
      .optional(),
    parentName: nameField("your parent or guardian's name"),
    parentPhone: optionalPhoneField,
    consent: z.literal(true, {
      error: "Please consent to be contacted about your enquiry.",
    }),
  });

export type Enquiry = z.infer<typeof enquirySchema>;

export type FieldErrors = Record<string, string>;

/** Turn Zod issues into a field -> first-error map suitable for the browser. */
export function formatFieldErrors(error: z.ZodError): FieldErrors {
  const result: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!result[key]) result[key] = issue.message;
  }
  return result;
}
