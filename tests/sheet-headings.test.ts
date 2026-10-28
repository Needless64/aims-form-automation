import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SHEET_COLUMNS } from "@/lib/sheets";

/**
 * The Apps Script in the README carries its own copy of the headings so its
 * one-time `resetSheet()` can write them without a request from the site. That
 * copy is only useful if it matches the columns the site actually appends, so
 * a drift fails here rather than silently mislabelling the college's ledger.
 */
function documentedHeader(): string[] {
  const readme = readFileSync(join(process.cwd(), "README.md"), "utf8");
  const block = readme.match(/const HEADER = \[([\s\S]*?)\];/);
  if (!block) throw new Error("README has no HEADER array in the Apps Script.");
  return [...block[1].matchAll(/'([^']*)'/g)].map((match) => match[1]);
}

describe("spreadsheet headings", () => {
  it("match the columns the site writes, in order", () => {
    expect(documentedHeader()).toEqual([...SHEET_COLUMNS]);
  });

  it("carry no undergraduate columns", () => {
    for (const column of documentedHeader()) {
      expect(column).not.toMatch(/NEET|qualification|marks/i);
    }
  });
});
