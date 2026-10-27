import { describe, expect, it } from "vitest";
import { formatSubmissionTime, generateReferenceId } from "@/lib/reference";

describe("reference IDs", () => {
  it("generates a readable AIMS reference with the admissions year", () => {
    const id = generateReferenceId(new Date("2026-10-27T13:12:00Z"));
    expect(id).toMatch(/^AIMS-26-[A-HJ-NP-Z2-9]{6}$/);
  });

  it("does not repeat across many enquiries", () => {
    const ids = new Set(
      Array.from({ length: 500 }, () => generateReferenceId()),
    );
    expect(ids.size).toBe(500);
  });

  it("formats the submission time in India Standard Time", () => {
    const label = formatSubmissionTime(new Date("2026-10-27T13:12:00Z"));
    expect(label).toContain("27 October 2026");
    expect(label).toContain("6:42 PM");
    expect(label).toContain("IST");
  });

  it("rolls the reference year over in IST, not UTC", () => {
    // 31 Dec 2026 20:00 UTC is 1 Jan 2027 01:30 IST.
    const id = generateReferenceId(new Date("2026-12-31T20:00:00Z"));
    expect(id.startsWith("AIMS-27-")).toBe(true);
  });
});
