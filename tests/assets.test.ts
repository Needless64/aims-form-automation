import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { BROCHURE } from "@/lib/institution";
import { VIDEOS } from "@/lib/videos";

const publicFile = (relative: string) =>
  join(process.cwd(), "public", relative.replace(/^\//, ""));

/**
 * Just enough PNG to read an asset's pixels, so the logo can be asserted on
 * rather than merely required to exist. No image library is a dependency here.
 */
function readPng(path: string) {
  const file = readFileSync(path);
  const width = file.readUInt32BE(16);
  const height = file.readUInt32BE(20);
  const colorType = file[25];
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;
  if (!channels) throw new Error(`unsupported PNG colour type ${colorType}`);

  const parts: Buffer[] = [];
  for (let offset = 8; offset < file.length; ) {
    const length = file.readUInt32BE(offset);
    if (file.toString("ascii", offset + 4, offset + 8) === "IDAT") {
      parts.push(file.subarray(offset + 8, offset + 8 + length));
    }
    offset += length + 12;
  }
  const raw = inflateSync(Buffer.concat(parts));

  const stride = width * channels;
  const pixels = Buffer.alloc(height * stride);
  for (let y = 0, cursor = 0; y < height; y += 1) {
    const filter = raw[cursor];
    cursor += 1;
    const line = raw.subarray(cursor, cursor + stride);
    cursor += stride;
    const above = y ? pixels.subarray((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    const row = pixels.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x += 1) {
      const left = x >= channels ? row[x - channels] : 0;
      const up = above[x];
      const upLeft = x >= channels ? above[x - channels] : 0;
      const value = line[x];
      if (filter === 0) row[x] = value;
      else if (filter === 1) row[x] = (value + left) & 0xff;
      else if (filter === 2) row[x] = (value + up) & 0xff;
      else if (filter === 3) row[x] = (value + ((left + up) >> 1)) & 0xff;
      else {
        const base = left + up - upLeft;
        const [pa, pb, pc] = [
          Math.abs(base - left),
          Math.abs(base - up),
          Math.abs(base - upLeft),
        ];
        row[x] =
          (value +
            (pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft)) &
          0xff;
      }
    }
  }

  return {
    width,
    height,
    opaque: (x: number, y: number) => pixels[(y * width + x) * channels + 3] > 100,
  };
}

describe("brochure", () => {
  it("ships the PDF that the tile links to", () => {
    const file = publicFile(BROCHURE.href);
    expect(BROCHURE.href.endsWith(".pdf")).toBe(true);
    expect(existsSync(file)).toBe(true);
  });

  it("keeps the PDF small enough to download on a phone", () => {
    const { size } = statSync(publicFile(BROCHURE.href));
    expect(size).toBeGreaterThan(0);
    expect(size).toBeLessThan(8 * 1024 * 1024);
  });

  it("states a page count and a size that match the file", () => {
    const { size } = statSync(publicFile(BROCHURE.href));
    expect(BROCHURE.pages).toBeGreaterThan(0);
    expect(BROCHURE.sizeLabel).toMatch(/^\d+(\.\d)? MB$/);
    expect(Math.abs(size / 1024 / 1024 - Number.parseFloat(BROCHURE.sizeLabel))).toBeLessThan(0.1);
    expect(BROCHURE.fileName).toMatch(/\.pdf$/);
  });
});

describe("crested emblem", () => {
  const file = publicFile("/images/aims-emblem.png");

  it("ships the transparent crest the header and footer render", () => {
    expect(existsSync(file)).toBe(true);
    const emblem = readPng(file);
    // Transparency is what lets one file sit on the header tile, the white
    // footer tile and any future surface without a pasted-in background.
    expect(emblem.opaque(0, 0)).toBe(false);
    expect(emblem.opaque(emblem.width - 1, emblem.height - 1)).toBe(false);
    expect(emblem.opaque(emblem.width >> 1, emblem.height >> 1)).toBe(true);
  });

  it("ships the whole crest, not the clipped crop it replaces", () => {
    const emblem = readPng(file);
    // The retired artwork was cut flat down its right edge. A crest is mirrored
    // about its centre, so overlaying it on its own reflection catches any crop:
    // the complete crest scores ~0.80 here, the clipped one scored 0.19.
    let shared = 0;
    let union = 0;
    for (let y = 0; y < emblem.height; y += 1) {
      for (let x = 0; x < emblem.width; x += 1) {
        const left = emblem.opaque(x, y);
        const right = emblem.opaque(emblem.width - 1 - x, y);
        if (left || right) union += 1;
        if (left && right) shared += 1;
      }
    }
    expect(shared / union).toBeGreaterThan(0.7);
  });

  it("is big and small enough for the slots it fills", () => {
    const emblem = readPng(file);
    // Rendered at 34px in the header and 46px in the footer, so the long edge
    // has to cover the larger slot on a high-density screen.
    expect(Math.max(emblem.width, emblem.height)).toBeGreaterThanOrEqual(80);
    expect(statSync(file).size).toBeLessThan(60 * 1024);
  });
});

describe("video section", () => {
  it("uses unique, well-formed YouTube ids", () => {
    const ids = VIDEOS.map((video) => video.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^[A-Za-z0-9_-]{11}$/);
    }
  });

  it("ships the local thumbnail each card renders", () => {
    for (const video of VIDEOS) {
      expect(existsSync(publicFile(`/images/videos/${video.id}.jpg`))).toBe(true);
    }
  });

  it("credits the source and duration shown under each card", () => {
    for (const video of VIDEOS) {
      expect(video.source.trim().length).toBeGreaterThan(2);
      expect(video.title.trim().length).toBeGreaterThan(8);
      expect(video.duration).toMatch(/^\d+:[0-5]\d$/);
    }
  });
});
