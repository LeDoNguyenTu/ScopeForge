import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isBlockedAddress } from "./normalize-target";
import type { VerificationResult } from "./types";

const TOKEN_TTL_MS = 30 * 60 * 1000;
const MAX_BODY_BYTES = 4 * 1024;
const VERIFY_PATH = "/.well-known/scopeforge-verification.txt";

type VerificationDependencies = {
  resolveHostname?: (hostname: string) => Promise<string[]>;
  fetcher?: (input: URL, init: RequestInit) => Promise<Response>;
};

export function hashVerificationToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function createVerificationChallenge(): { token: string; tokenHash: string; expiresAt: Date } {
  const token = randomBytes(32).toString("base64url");
  return {
    token,
    tokenHash: hashVerificationToken(token),
    expiresAt: new Date(Date.now() + TOKEN_TTL_MS)
  };
}

function safeTokenEquals(actual: string, expected: string): boolean {
  const a = Buffer.from(actual.trim(), "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

async function defaultResolveHostname(hostname: string): Promise<string[]> {
  const records = await lookup(hostname, { all: true, verbatim: true });
  return records.map((record) => record.address);
}

async function resolvePublicAddresses(
  hostname: string,
  resolver: (hostname: string) => Promise<string[]>
): Promise<string[]> {
  if (isBlockedAddress(hostname)) throw new Error("Target resolves to a private or local address.");
  const resolved = await resolver(hostname);
  if (!resolved.length) throw new Error("Target hostname did not resolve.");
  const addresses = resolved.map((address) => address.toLowerCase()).sort();
  if (addresses.some(isBlockedAddress)) throw new Error("Target resolves to a private or local address.");
  return addresses;
}

async function readBoundedText(response: Response): Promise<string> {
  const declared = response.headers.get("content-length");
  if (declared && Number(declared) > MAX_BODY_BYTES) throw new Error("Verification response is larger than 4 KiB.");

  if (!response.body) {
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > MAX_BODY_BYTES) throw new Error("Verification response is larger than 4 KiB.");
    return text;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) throw new Error("Verification response is larger than 4 KiB.");
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const merged = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

export async function verifyHttpWellKnownTarget(
  input: {
    canonicalTarget: string;
    expectedToken: string;
  },
  dependencies: VerificationDependencies = {}
): Promise<VerificationResult> {
  let base: URL;
  try {
    base = new URL(input.canonicalTarget);
  } catch {
    return { verified: false, reason: "The stored target URL is invalid." };
  }

  if (base.protocol !== "https:" || base.username || base.password) {
    return { verified: false, reason: "Verification is available only for credential-free HTTPS targets." };
  }

  const endpoint = new URL(VERIFY_PATH, base.origin);
  const resolver = dependencies.resolveHostname ?? defaultResolveHostname;
  const fetcher = dependencies.fetcher ?? ((request, init) => fetch(request, init));

  try {
    const before = await resolvePublicAddresses(endpoint.hostname, resolver);
    const response = await fetcher(endpoint, {
      method: "GET",
      redirect: "manual",
      headers: { Accept: "text/plain" },
      signal: AbortSignal.timeout(5000),
      cache: "no-store"
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (location) {
        const redirected = new URL(location, endpoint);
        if (redirected.hostname.toLowerCase() !== endpoint.hostname.toLowerCase()) {
          return { verified: false, reason: "Verification redirects to another hostname are not allowed." };
        }
      }
      return { verified: false, reason: "Verification redirects are not followed." };
    }

    if (!response.ok) return { verified: false, reason: `Verification file returned HTTP ${response.status}.` };

    const after = await resolvePublicAddresses(endpoint.hostname, resolver);
    if (before.join(",") !== after.join(",")) {
      return { verified: false, reason: "Target DNS changed during verification. Try again when DNS is stable." };
    }

    const body = await readBoundedText(response);
    if (!safeTokenEquals(body, input.expectedToken)) {
      return { verified: false, reason: "Verification file did not contain the expected token." };
    }

    return { verified: true, reason: "Proof of control verified." };
  } catch (error) {
    if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
      return { verified: false, reason: "Verification request timed out." };
    }
    return { verified: false, reason: error instanceof Error ? error.message : "Verification failed safely." };
  }
}
