import { describe, expect, it } from "vitest";
import { enquirySchema, formatFieldErrors } from "@/lib/validation";
import { minimalRequestBody, validRequestBody } from "./fixtures";

const REQUIRED_FIELDS = [
  "fullName",
  "email",
  "phone",
  "course",
  "city",
  "currentCollege",
  "qualification",
  "marks",
  "neetStatus",
  "interests",
  "goals",
  "parentName",
  "consent",
];

describe("enquiry validation", () => {
  it("accepts a complete enquiry and normalizes phone, email and marks", () => {
    const result = enquirySchema.safeParse(validRequestBody);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.email).toBe("ananya.rao@example.com");
    expect(result.data.phone).toBe("9876543210");
    expect(result.data.city).toBe("Hyderabad");
    expect(result.data.fullName).toBe("Ananya Rao");
    expect(result.data.marks).toBe("95.2%");
  });

  it("requires every field in the submission", () => {
    for (const field of REQUIRED_FIELDS) {
      const body: Record<string, unknown> = minimalRequestBody();
      delete body[field];
      const result = enquirySchema.safeParse(body);
      expect(result.success, field).toBe(false);
      if (result.success) continue;
      expect(Object.keys(formatFieldErrors(result.error)), field).toContain(
        field,
      );
    }
  });

  it("rejects empty or whitespace-only required text", () => {
    for (const field of ["fullName", "city", "currentCollege", "goals", "parentName"]) {
      const result = enquirySchema.safeParse(
        minimalRequestBody({ [field]: "   " }),
      );
      expect(result.success, field).toBe(false);
    }
  });

  it("rejects non-string values for text fields", () => {
    for (const field of ["fullName", "city", "currentCollege", "marks", "parentName"]) {
      const result = enquirySchema.safeParse(
        minimalRequestBody({ [field]: 123 }),
      );
      expect(result.success, field).toBe(false);
    }
    expect(
      enquirySchema.safeParse(minimalRequestBody({ interests: "Clinical practice" }))
        .success,
    ).toBe(false);
  });

  it("rejects an invalid email address", () => {
    for (const email of ["not-an-email", "a@b", "a b@example.com", "@example.com"]) {
      const result = enquirySchema.safeParse(minimalRequestBody({ email }));
      expect(result.success, email).toBe(false);
    }
  });

  it("rejects invalid Indian mobile numbers", () => {
    for (const phone of ["12345", "1234567890", "5876543210", "98765abcde", "+1 415 555 0100"]) {
      const result = enquirySchema.safeParse(minimalRequestBody({ phone }));
      expect(result.success, phone).toBe(false);
    }
  });

  it("normalizes common Indian phone formats", () => {
    for (const phone of ["9876543210", "+91 98765 43210", "09876543210", "(987) 654-3210"]) {
      const result = enquirySchema.safeParse(minimalRequestBody({ phone }));
      expect(result.success, phone).toBe(true);
      if (result.success) expect(result.data.phone).toBe("9876543210");
    }
  });

  it("requires the consent checkbox to be literally true", () => {
    for (const consent of [false, "true", undefined, null, 1]) {
      const result = enquirySchema.safeParse(minimalRequestBody({ consent }));
      expect(result.success, String(consent)).toBe(false);
    }
  });

  it("rejects unlisted programmes and qualifications", () => {
    expect(
      enquirySchema.safeParse(
        minimalRequestBody({ course: "Computer Science Engineering" }),
      ).success,
    ).toBe(false);
    expect(
      enquirySchema.safeParse(minimalRequestBody({ qualification: "PhD" })).success,
    ).toBe(false);
  });

  it("accepts marks as a number or percentage and stores a percentage", () => {
    for (const [input, expected] of [
      ["92.4", "92.4%"],
      ["92.4%", "92.4%"],
      ["100", "100%"],
      ["71", "71%"],
    ] as const) {
      const result = enquirySchema.safeParse(minimalRequestBody({ marks: input }));
      expect(result.success, input).toBe(true);
      if (result.success) expect(result.data.marks).toBe(expected);
    }
  });

  it("rejects impossible or malformed marks", () => {
    for (const marks of ["0", "101", "-5", "92.444", "ninety", "640/720", 92]) {
      const result = enquirySchema.safeParse(minimalRequestBody({ marks }));
      expect(result.success, String(marks)).toBe(false);
    }
  });

  it("requires a NEET score only from candidates who appeared", () => {
    const appeared = enquirySchema.safeParse(
      minimalRequestBody({ neetStatus: "Appeared", neetScore: "" }),
    );
    expect(appeared.success).toBe(false);
    if (!appeared.success) {
      expect(formatFieldErrors(appeared.error).neetScore).toMatch(/NEET-UG score/i);
    }

    const notAppeared = enquirySchema.safeParse(
      minimalRequestBody({ neetStatus: "Not appeared", neetScore: "" }),
    );
    expect(notAppeared.success).toBe(true);
    if (notAppeared.success) expect(notAppeared.data.neetScore).toBeUndefined();
  });

  it("rejects scores outside 0–720 and non-numeric scores", () => {
    for (const neetScore of ["721", "abc", "-10", "640.5", 640]) {
      const result = enquirySchema.safeParse(minimalRequestBody({ neetScore }));
      expect(result.success, String(neetScore)).toBe(false);
    }
  });

  it("rejects a NEET status that is not listed", () => {
    expect(
      enquirySchema.safeParse(minimalRequestBody({ neetStatus: "Maybe" })).success,
    ).toBe(false);
  });

  it("requires at least one area of interest from the listed values", () => {
    expect(
      enquirySchema.safeParse(minimalRequestBody({ interests: [] })).success,
    ).toBe(false);
    expect(
      enquirySchema.safeParse(minimalRequestBody({ interests: ["Astrology"] }))
        .success,
    ).toBe(false);
    expect(
      enquirySchema.safeParse(
        minimalRequestBody({ interests: ["Clinical practice", "Medical research"] }),
      ).success,
    ).toBe(true);
  });

  it("rejects overlong text", () => {
    expect(
      enquirySchema.safeParse(minimalRequestBody({ goals: "x".repeat(601) })).success,
    ).toBe(false);
    expect(
      enquirySchema.safeParse(minimalRequestBody({ city: "x".repeat(81) })).success,
    ).toBe(false);
  });

  it("rejects markup characters in name and place fields", () => {
    expect(
      enquirySchema.safeParse(
        minimalRequestBody({ fullName: "<img src=x onerror=alert(1)>" }),
      ).success,
    ).toBe(false);
    expect(
      enquirySchema.safeParse(minimalRequestBody({ city: "<b>Hyderabad</b>" }))
        .success,
    ).toBe(false);
  });

  it("maps issues to a field -> first-error map", () => {
    const result = enquirySchema.safeParse({});
    expect(result.success).toBe(false);
    if (result.success) return;
    const errors = formatFieldErrors(result.error);
    expect(errors.fullName).toMatch(/full name/i);
    expect(errors.email).toMatch(/email/i);
    expect(errors.phone).toMatch(/mobile/i);
    expect(errors.course).toMatch(/programme/i);
    expect(errors.consent).toMatch(/consent/i);
    expect(Object.keys(errors).length).toBeGreaterThanOrEqual(13);
  });
});
