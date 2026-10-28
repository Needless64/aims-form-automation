import { describe, expect, it, vi } from "vitest";
import {
  SHEET_COLUMNS,
  SheetConfigurationError,
  getSheetConfig,
  recordEnquiry,
  recordEnquiryIfConfigured,
  sheetRow,
} from "@/lib/sheets";
import { validEnquiry } from "./fixtures";

const input = {
  enquiry: validEnquiry,
  referenceId: "AIMS-26-AB7K9Q",
  submittedAt: new Date("2026-10-27T16:04:28.414Z"),
};

const sheet = {
  endpoint: "https://script.google.com/macros/s/AKfycbx/exec",
  token: "shared-secret",
  timeoutMs: 5_000,
};

function stubFetch(
  handler: (url: string, init: RequestInit) => Promise<Response> | Response,
) {
  const mock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>();
  mock.mockImplementation(async (url, init) => handler(url, init));
  vi.stubGlobal("fetch", mock);
  return mock;
}

function postedBody(mock: ReturnType<typeof stubFetch>) {
  const [, init] = mock.mock.calls[0];
  return JSON.parse(String(init.body)) as {
    token: string;
    header: string[];
    values: string[];
  };
}

describe("spreadsheet configuration", () => {
  it("is off until a webhook is configured", () => {
    expect(getSheetConfig({})).toBeNull();
    expect(getSheetConfig({ SHEETS_WEBHOOK_URL: "   " })).toBeNull();
  });

  it("reads the endpoint, the shared secret and a timeout", () => {
    expect(
      getSheetConfig({
        SHEETS_WEBHOOK_URL: sheet.endpoint,
        SHEETS_WEBHOOK_SECRET: sheet.token,
      }),
    ).toEqual({ ...sheet, timeoutMs: 10_000 });

    expect(
      getSheetConfig({
        SHEETS_WEBHOOK_URL: sheet.endpoint,
        SHEETS_TIMEOUT_MS: "2500",
      })?.timeoutMs,
    ).toBe(2_500);
  });

  it("refuses to send student data over a plain-http endpoint", () => {
    expect(() =>
      getSheetConfig({ SHEETS_WEBHOOK_URL: "http://example.test/hook" }),
    ).toThrow(SheetConfigurationError);
  });

  it("reports a misconfigured endpoint instead of throwing at the caller", async () => {
    vi.stubEnv("SHEETS_WEBHOOK_URL", "http://example.test/hook");
    const fetchMock = stubFetch(() => new Response("{}"));
    await expect(recordEnquiryIfConfigured(input)).resolves.toEqual({
      status: "failed",
      errorCode: "sheet_config_error",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does nothing at all when the ledger is switched off", async () => {
    const fetchMock = stubFetch(() => new Response("{}"));
    await expect(recordEnquiryIfConfigured(input)).resolves.toEqual({
      status: "skipped",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("spreadsheet row", () => {
  it("fills every column, in order, from the submitted enquiry", () => {
    const row = sheetRow(input);
    expect(row).toHaveLength(SHEET_COLUMNS.length);
    expect(row[SHEET_COLUMNS.indexOf("Reference ID")]).toBe("AIMS-26-AB7K9Q");
    expect(row[SHEET_COLUMNS.indexOf("Submitted at (IST)")]).toBe(
      "27 October 2026, 9:34 PM IST",
    );
    expect(row[SHEET_COLUMNS.indexOf("Submitted at (ISO 8601)")]).toBe(
      "2026-10-27T16:04:28.414Z",
    );
    // No leading "+": Sheets would read it as a formula and show #ERROR!.
    expect(row[SHEET_COLUMNS.indexOf("Mobile number")]).toBe("91 98765 43210");
    expect(row[SHEET_COLUMNS.indexOf("Programme of interest")]).toBe(
      "General Medicine",
    );
    expect(row[SHEET_COLUMNS.indexOf("Areas of interest")]).toBe(
      "General Medicine, Radiology",
    );
    expect(row[SHEET_COLUMNS.indexOf("Consent to be contacted")]).toBe("Yes");
  });

  it("keeps the candidate's own words when they pick \"Others\"", () => {
    const row = sheetRow({
      ...input,
      enquiry: {
        ...validEnquiry,
        interests: ["Dermatology", "Others"],
        interestOther: "Cardiology research",
      },
    });
    expect(row[SHEET_COLUMNS.indexOf("Areas of interest")]).toBe(
      "Dermatology, Others (Cardiology research)",
    );
  });

  it("never writes a value Sheets would evaluate as a formula", () => {
    for (const value of sheetRow(input)) {
      expect(value).not.toMatch(/^[=+@]/);
    }
  });

  it("carries no undergraduate columns", () => {
    for (const label of [
      "Qualification",
      "Marks",
      "NEET",
    ]) {
      expect(
        SHEET_COLUMNS.some((column) => column.includes(label)),
        label,
      ).toBe(false);
    }
  });
});

describe("appending to the spreadsheet", () => {
  it("posts the header and the row to the web app", async () => {
    const fetchMock = stubFetch(() =>
      new Response(JSON.stringify({ ok: true, row: 12 })),
    );

    await expect(recordEnquiry(input, sheet)).resolves.toEqual({
      status: "saved",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(sheet.endpoint);
    expect(init.method).toBe("POST");

    const body = postedBody(fetchMock);
    expect(body.token).toBe("shared-secret");
    expect(body.header).toEqual([...SHEET_COLUMNS]);
    expect(body.values).toEqual(sheetRow(input));
  });

  it("fails, without throwing, when the web app answers with an error", async () => {
    stubFetch(() => new Response("Server error", { status: 500 }));
    await expect(recordEnquiry(input, sheet)).resolves.toEqual({
      status: "failed",
      errorCode: "sheet_http_500",
    });
  });

  it("fails when the script itself reports failure under a 200", async () => {
    stubFetch(
      () => new Response(JSON.stringify({ ok: false, error: "no sheet" })),
    );
    await expect(recordEnquiry(input, sheet)).resolves.toEqual({
      status: "failed",
      errorCode: "sheet_rejected",
    });
  });

  it("fails when the body is not the documented JSON", async () => {
    stubFetch(() => new Response("<html>Sign in</html>"));
    await expect(recordEnquiry(input, sheet)).resolves.toEqual({
      status: "failed",
      errorCode: "sheet_rejected",
    });
  });

  it("fails when the network is unreachable", async () => {
    stubFetch(() => Promise.reject(new TypeError("fetch failed")));
    await expect(recordEnquiry(input, sheet)).resolves.toEqual({
      status: "failed",
      errorCode: "sheet_unreachable",
    });
  });

  it("gives up on a hung endpoint instead of holding the enquiry open", async () => {
    stubFetch(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(Object.assign(new Error("aborted"), { name: "TimeoutError" })),
          );
        }),
    );
    await expect(recordEnquiry(input, { ...sheet, timeoutMs: 5 })).resolves.toEqual(
      { status: "failed", errorCode: "sheet_timeout" },
    );
  });
});
