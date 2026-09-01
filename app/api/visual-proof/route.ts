import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TARGET = "https://scopeforge-8kvrdim02-itsbrian.vercel.app/";
const CHUNK_SIZE = 48000;

export async function GET(request: NextRequest) {
  const captureUrl = new URL("https://api.webstractor.com/v1/screenshot");
  captureUrl.searchParams.set("url", TARGET);
  captureUrl.searchParams.set("width", "1920");
  captureUrl.searchParams.set("height", "1080");
  captureUrl.searchParams.set("fullPage", "false");
  captureUrl.searchParams.set("format", "png");

  const capture = await fetch(captureUrl, { cache: "no-store" });
  if (!capture.ok) {
    return Response.json({
      ok: false,
      target: TARGET,
      status: capture.status,
      detail: (await capture.text()).slice(0, 1200),
    }, { status: 502 });
  }

  const bytes = Buffer.from(await capture.arrayBuffer());
  const base64 = bytes.toString("base64");
  const totalParts = Math.ceil(base64.length / CHUNK_SIZE);
  const requestedPart = Number(new URL(request.url).searchParams.get("part") ?? "0");
  const part = Number.isInteger(requestedPart)
    ? Math.max(0, Math.min(requestedPart, Math.max(0, totalParts - 1)))
    : 0;
  const start = part * CHUNK_SIZE;

  return Response.json({
    ok: true,
    target: TARGET,
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
