import { describe, expect, it } from "vitest";
import {
  assertMailPayloadKey,
  generateMailPayloadKey,
  MailPayloadError,
  openMailPayload,
  sealMailPayload,
  type MailPayload,
} from "@/lib/mail-payload";
import { validEnquiry } from "./fixtures";

const key = generateMailPayloadKey();

const payload: MailPayload = {
  referenceId: "AIMS-26-AB7K9Q",
  submittedAt: "2026-10-27T13:12:00.000Z",
  enquiry: validEnquiry,
};

describe("sealed mail payload", () => {
  it("round-trips the enquiry the runner needs", async () => {
    const sealed = await sealMailPayload(payload, key);
    const opened = await openMailPayload(sealed, key);

    expect(opened.referenceId).toBe(payload.referenceId);
    expect(opened.submittedAt).toBe(payload.submittedAt);
    expect(opened.enquiry).toEqual(validEnquiry);
  });

  it("leaks nothing in clear text — a public repository's run is readable", async () => {
    const sealed = await sealMailPayload(payload, key);

    expect(sealed).not.toContain("Ananya");
    expect(sealed).not.toContain("ananya.rao@example.com");
    expect(sealed).not.toContain("9876543210");
    expect(sealed).not.toContain("Narayana");
    expect(sealed).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("seals the same payload differently every time", async () => {
    expect(await sealMailPayload(payload, key)).not.toBe(
      await sealMailPayload(payload, key),
    );
  });

  it("refuses a tampered token", async () => {
    const sealed = await sealMailPayload(payload, key);
    const middle = Math.floor(sealed.length / 2);
    const flipped = sealed[middle] === "A" ? "B" : "A";
    const tampered = sealed.slice(0, middle) + flipped + sealed.slice(middle + 1);

    await expect(openMailPayload(tampered, key)).rejects.toBeInstanceOf(
      MailPayloadError,
    );
  });

  it("refuses a token sealed with another key", async () => {
    const sealed = await sealMailPayload(payload, generateMailPayloadKey());

    await expect(openMailPayload(sealed, key)).rejects.toThrow(
      /could not be opened/,
    );
  });

  it("refuses a key that is not 32 bytes", async () => {
    expect(() => assertMailPayloadKey("")).toThrow(/not configured/);
    expect(() => assertMailPayloadKey("c2hvcnQ=")).toThrow(/32 bytes/);
    expect(() => assertMailPayloadKey("not base64 !!!")).toThrow(
      MailPayloadError,
    );
    await expect(sealMailPayload(payload, "c2hvcnQ=")).rejects.toThrow(
      /32 bytes/,
    );
  });

  it("generates a usable 32-byte key", () => {
    const generated = generateMailPayloadKey();

    expect(() => assertMailPayloadKey(generated)).not.toThrow();
    expect(new Set([generateMailPayloadKey(), generated]).size).toBe(2);
  });

  it("refuses a payload that is not a valid enquiry", async () => {
    const sealed = await sealMailPayload(
      {
        referenceId: "AIMS-26-AB7K9Q",
        submittedAt: payload.submittedAt,
        enquiry: { ...validEnquiry, email: "not-an-address" },
      } as unknown as MailPayload,
      key,
    );

    await expect(openMailPayload(sealed, key)).rejects.toThrow(/valid enquiry/);
  });

  it("refuses a reference ID the form never issues", async () => {
    const sealed = await sealMailPayload(
      { ...payload, referenceId: "AIMS-26-ABC" },
      key,
    );

    await expect(openMailPayload(sealed, key)).rejects.toThrow(
      /reference ID or submission time/,
    );
  });

  it("refuses a token that is not base64 at all", async () => {
    await expect(openMailPayload("not a token!!!", key)).rejects.toThrow(
      /not valid base64/,
    );
  });
});
