import { z } from "zod";
import {
  COURSES,
  INTERESTS,
  NEET_STATUSES,
  QUALIFICATIONS,
} from "@/lib/institution";

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

/** A percentage written as `92`, `92.4` or `92.4%`, stored as `92.4%`. */
const marksField = z
  .string({ error: "Please enter your qualifying percentage." })
  .trim()
  .transform((value) => value.replace(/%$/, "").trim())
  .refine((value) => /^\d{1,3}(\.\d{1,2})?$/.test(value), {
    error: "Enter a percentage between 0 and 100, for example 92.4.",
  })
  .refine((value) => Number(value) > 0 && Number(value) <= 100, {
    error: "Percentage must be greater than 0 and at most 100.",
  })
  .transform((value) => `${Number(value)}%`);

/**
 * NEET-UG score is required from candidates who appeared for the exam and is
 * left empty by everyone else; it is the only conditionally applicable field.
 */
const neetScoreField = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z
    .string({ error: "Enter your NEET-UG score between 0 and 720." })
    .trim()
    .refine((value) => /^\d{1,3}$/.test(value), {
      error: "Enter your NEET-UG score as a whole number between 0 and 720.",
    })
    .refine((value) => Number(value) <= 720, {
      error: "NEET-UG score cannot be more than 720.",
    })
    .transform((value) => String(Number(value)))
    .optional(),
);

export const enquirySchema = z
  .object({
    fullName: nameField("the student's full name"),
    email: emailField,
    phone: phoneField,
    course: z.enum(COURSES, {
      error: "Please select the programme you are interested in.",
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
    qualification: z.enum(QUALIFICATIONS, {
      error: "Please select your academic qualification.",
    }),
    marks: marksField,
    neetStatus: z.enum(NEET_STATUSES, {
      error: "Please select your NEET-UG status.",
    }),
    neetScore: neetScoreField,
    interests: z
      .array(z.enum(INTERESTS, { error: "Select a valid area of interest." }), {
        error: "Select at least one area of interest.",
      })
      .min(1, { error: "Select at least one area of interest." })
      .max(INTERESTS.length, {
        error: "Select only the listed areas of interest.",
      }),
    goals: requiredText({
      label: "your academic or career goals",
      max: 600,
      min: 10,
      allowNewlines: true,
    }),
    parentName: nameField("your parent or guardian's name"),
    consent: z.literal(true, {
      error: "Please consent to being contacted about your enquiry.",
    }),
  })
  .superRefine((value, context) => {
    if (value.neetStatus === "Appeared" && !value.neetScore) {
      context.addIssue({
        code: "custom",
        path: ["neetScore"],
        message: "Enter your NEET-UG score between 0 and 720.",
      });
    }
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
