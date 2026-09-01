import { NextRequest } from "next/server";
import { inflateSync } from "node:zlib";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_TARGET = "https://scopeforge-8kvrdim02-itsbrian.vercel.app/";
const CHUNK_SIZE = 48000;

type DecodedPng = Readonly<{
  width: number;
  height: number;
  channels: number;
  pixels: Uint8Array;
}>;

function paeth(a: number, b: number, c: number) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

function decodePng(bytes: Buffer): DecodedPng {
  if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    throw new Error("Capture is not a PNG");
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idat: Buffer[] = [];

  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
  }

  if (bitDepth !== 8 || interlace !== 0 || (colorType !== 2 && colorType !== 6)) {
    throw new Error(`Unsupported PNG format: depth=${bitDepth}, colorType=${colorType}, interlace=${interlace}`);
  }

  const channels = colorType === 6 ? 4 : 3;
  const stride = width * channels;
  const raw = inflateSync(Buffer.concat(idat));
  const pixels = new Uint8Array(width * height * channels);
  let source = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = raw[source++];
    const rowStart = y * stride;
    for (let x = 0; x < stride; x += 1) {
      const value = raw[source++];
      const left = x >= channels ? pixels[rowStart + x - channels] : 0;
      const up = y > 0 ? pixels[rowStart - stride + x] : 0;
      const upLeft = y > 0 && x >= channels ? pixels[rowStart - stride + x - channels] : 0;
      let decoded = value;
      if (filter === 1) decoded = (value + left) & 255;
      else if (filter === 2) decoded = (value + up) & 255;
      else if (filter === 3) decoded = (value + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) decoded = (value + paeth(left, up, upLeft)) & 255;
      else if (filter !== 0) throw new Error(`Unsupported PNG filter ${filter}`);
      pixels[rowStart + x] = decoded;
    }
  }

  return { width, height, channels, pixels };
}

function samplePixel(image: DecodedPng, x: number, y: number) {
  const index = (y * image.width + x) * image.channels;
  return [image.pixels[index], image.pixels[index + 1], image.pixels[index + 2]] as const;
}

function classify(r: number, g: number, b: number) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const luminance = r * 0.2126 + g * 0.7152 + b * 0.0722;
  if (luminance < 13) return " ";
  if (r > g * 1.3 && r > b * 1.7 && r > 80) return "O";
  if (g > r * 1.15 && b > r * 1.15 && (g + b) > 130) return "T";
  if (b > r * 1.25 && b > g * 1.05 && b > 70) return "C";
  if (luminance > 205 && max - min < 45) return "W";
  if (luminance > 115) return "+";
  if (luminance > 45) return "#";
  return ".";
}

function asciiPreview(image: DecodedPng, cols = 120, rows = 68) {
  const output: string[] = [];
  const counts: Record<string, number> = { " ": 0, ".": 0, "#": 0, "+": 0, W: 0, T: 0, C: 0, O: 0 };
  for (let gy = 0; gy < rows; gy += 1) {
    let row = "";
    const y = Math.min(image.height - 1, Math.floor(((gy + 0.5) / rows) * image.height));
    for (let gx = 0; gx < cols; gx += 1) {
      const x = Math.min(image.width - 1, Math.floor(((gx + 0.5) / cols) * image.width));
      const [r, g, b] = samplePixel(image, x, y);
      const symbol = classify(r, g, b);
      counts[symbol] = (counts[symbol] ?? 0) + 1;
      row += symbol;
    }
    output.push(row);
  }
  return { cols, rows, legend: "space=black .=deep-dark #=structure +=mid W=white T=teal C=cyan O=orange", counts, output };
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const requestedTarget = requestUrl.searchParams.get("target") ?? DEFAULT_TARGET;
  const parsedTarget = new URL(requestedTarget);
  if (parsedTarget.protocol !== "https:" || !parsedTarget.hostname.endsWith("vercel.app")) {
    return Response.json({ ok: false, error: "Diagnostic target must be an HTTPS vercel.app URL" }, { status: 400 });
  }

  const captureUrl = new URL("https://api.webstractor.com/v1/screenshot");
  captureUrl.searchParams.set("url", parsedTarget.toString());
  captureUrl.searchParams.set("width", "1920");
  captureUrl.searchParams.set("height", "1080");
  captureUrl.searchParams.set("fullPage", "false");
  captureUrl.searchParams.set("format", "png");

  const capture = await fetch(captureUrl, { cache: "no-store" });
  if (!capture.ok) {
    return Response.json({
      ok: false,
      target: parsedTarget.toString(),
      status: capture.status,
      detail: (await capture.text()).slice(0, 1200),
    }, { status: 502 });
  }

  const bytes = Buffer.from(await capture.arrayBuffer());
  if (requestUrl.searchParams.get("mode") === "ascii") {
    try {
      const decoded = decodePng(bytes);
      return Response.json({
        ok: true,
        target: parsedTarget.toString(),
        viewport: { width: 1920, height: 1080 },
        decoded: { width: decoded.width, height: decoded.height, channels: decoded.channels },
        preview: asciiPreview(decoded),
      }, { headers: { "Cache-Control": "no-store", "X-ScopeForge-Diagnostic": "v5-live-capture" } });
    } catch (error) {
      return Response.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
  }

  const base64 = bytes.toString("base64");
  const totalParts = Math.ceil(base64.length / CHUNK_SIZE);
  const requestedPart = Number(requestUrl.searchParams.get("part") ?? "0");
  const part = Number.isInteger(requestedPart)
    ? Math.max(0, Math.min(requestedPart, Math.max(0, totalParts - 1)))
    : 0;
  const start = part * CHUNK_SIZE;

  return Response.json({
    ok: true,
    target: parsedTarget.toString(),
    viewport: { width: 1920, height: 1080 },
    contentType: capture.headers.get("content-type") ?? "image/png",
    byteLength: bytes.length,
    base64Length: base64.length,
    chunkSize: CHUNK_SIZE,
    part,
    totalParts,
    chunk: base64.slice(start, start + CHUNK_SIZE),
  }, {
    headers: {
      "Cache-Control": "no-store",
      "X-ScopeForge-Diagnostic": "v5-live-capture",
    },
  });
}
