import { describe, expect, it } from "vitest";
import { enquirySchema, formatFieldErrors } from "@/lib/validation";
import { minimalRequestBody, validRequestBody } from "./fixtures";

const REQUIRED_FIELDS = [
  "fullName",
  "email",
  "phone",
  "programme",
  "city",
  "currentCollege",
  "interests",
  "goals",
  "parentName",
  "consent",
];

describe("enquiry validation", () => {
  it("accepts a complete enquiry and normalizes phone, email and text", () => {
    const result = enquirySchema.safeParse(validRequestBody);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.email).toBe("ananya.rao@example.com");
    expect(result.data.phone).toBe("9876543210");
    expect(result.data.city).toBe("Hyderabad");
    expect(result.data.fullName).toBe("Ananya Rao");
    expect(result.data.programme).toBe("General Medicine");
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

  it("drops the undergraduate fields the form no longer collects", () => {
    const result = enquirySchema.safeParse(
      minimalRequestBody({
        qualification: "12th / Intermediate — completed",
        marks: "95.2%",
        neetStatus: "Appeared",
        neetScore: "640",
      }),
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).not.toHaveProperty("qualification");
    expect(result.data).not.toHaveProperty("marks");
    expect(result.data).not.toHaveProperty("neetStatus");
    expect(result.data).not.toHaveProperty("neetScore");
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
    for (const field of ["fullName", "city", "currentCollege", "parentName"]) {
      const result = enquirySchema.safeParse(
        minimalRequestBody({ [field]: 123 }),
      );
      expect(result.success, field).toBe(false);
    }
    expect(
      enquirySchema.safeParse(minimalRequestBody({ interests: "General Medicine" }))
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

  it("accepts only the published departments as the programme", () => {
    for (const programme of [
      "General Medicine",
      "Dermatology",
      "Paediatrics",
      "Respiratory Medicine",
      "General Surgery",
      "Orthopaedics",
      "Obstetric & Gynaecology",
      "Ophthalmology",
      "Oto – Rhinolaryngology / ENT",
      "Radiology",
      "Anaesthesia",
      "Biochemistry",
      "Pathology",
    ]) {
      expect(
        enquirySchema.safeParse(minimalRequestBody({ programme })).success,
        programme,
      ).toBe(true);
    }

    for (const programme of ["Computer Science Engineering", "MBBS", "general medicine"]) {
      expect(
        enquirySchema.safeParse(minimalRequestBody({ programme })).success,
        programme,
      ).toBe(false);
    }
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
      enquirySchema.safeParse(minimalRequestBody({ interests: ["Clinical practice"] }))
        .success,
    ).toBe(false);
    expect(
      enquirySchema.safeParse(
        minimalRequestBody({
          interests: ["Obstetrics & Gynecology", "General Surgery / Orthopedics"],
        }),
      ).success,
    ).toBe(true);
  });

  it("asks what \"Others\" means instead of recording a bare word", () => {
    expect(
      enquirySchema.safeParse(
        minimalRequestBody({ interests: ["Others"] }),
      ).success,
    ).toBe(false);

    const blankWithOthers = enquirySchema.safeParse(
      minimalRequestBody({ interests: ["Others"], interestOther: "   " }),
    );
    expect(blankWithOthers.success).toBe(false);
    if (!blankWithOthers.success) {
      expect(
        Object.keys(formatFieldErrors(blankWithOthers.error)),
      ).toContain("interestOther");
    }

    const described = enquirySchema.safeParse(
      minimalRequestBody({
        interests: ["General Medicine", "Others"],
        interestOther: "  Cardiology   research ",
      }),
    );
    expect(described.success).toBe(true);
    if (described.success) {
      expect(described.data.interestOther).toBe("Cardiology research");
    }
  });

  it("ignores the \"Others\" description when that option is not chosen", () => {
    const result = enquirySchema.safeParse(
      minimalRequestBody({ interests: ["Radiology"], interestOther: "Oncology" }),
    );
    expect(result.success).toBe(true);
  });

  it("caps the \"Others\" description", () => {
    expect(
      enquirySchema.safeParse(
        minimalRequestBody({
          interests: ["Others"],
          interestOther: "x".repeat(81),
        }),
      ).success,
    ).toBe(false);
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
    expect(errors.programme).toMatch(/programme/i);
    expect(errors.consent).toMatch(/consent/i);
    expect(Object.keys(errors).length).toBeGreaterThanOrEqual(10);
  });
});
