import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { lookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import { isBlockedAddress } from "./normalize-target";
import type { VerificationResult } from "./types";

const TOKEN_TTL_MS = 30 * 60 * 1000;
const MAX_BODY_BYTES = 4 * 1024;
const VERIFY_PATH = "/.well-known/scopeforge-verification.txt";

type PinnedRequestInput = {
  endpoint: URL;
  address: string;
  family: 4 | 6;
};

type PinnedHttpResponse = {
  status: number;
  location: string | null;
  body: string;
};

type VerificationDependencies = {
  resolveHostname?: (hostname: string) => Promise<string[]>;
  requester?: (input: PinnedRequestInput) => Promise<PinnedHttpResponse>;
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

async function resolvePinnedAddress(
  hostname: string,
  resolver: (hostname: string) => Promise<string[]>
): Promise<{ address: string; family: 4 | 6 }> {
  if (isBlockedAddress(hostname)) throw new Error("Target resolves to a private or local address.");

  const resolved = await resolver(hostname);
  if (!resolved.length) throw new Error("Target hostname did not resolve.");

  const addresses = [...new Set(resolved.map((address) => address.toLowerCase()))].sort();
  for (const address of addresses) {
    const family = isIP(address);
    if (family !== 4 && family !== 6) throw new Error("Target DNS returned an invalid address.");
    if (isBlockedAddress(address)) throw new Error("Target resolves to a private or local address.");
  }

  const address = addresses[0];
  const family = isIP(address);
  if (family !== 4 && family !== 6) throw new Error("Target DNS returned an invalid address.");
  return { address, family };
}

function defaultPinnedRequester(input: PinnedRequestInput): Promise<PinnedHttpResponse> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finishReject = (error: Error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    const request = httpsRequest(
      input.endpoint,
      {
        method: "GET",
        agent: false,
        headers: {
          Accept: "text/plain",
          "User-Agent": "ScopeForge-Verification/0.1"
        },
        servername: isIP(input.endpoint.hostname) ? undefined : input.endpoint.hostname,
        signal: AbortSignal.timeout(5000),
        lookup: ((_hostname: string, _options: unknown, callback: (error: NodeJS.ErrnoException | null, address: string, family: number) => void) => {
          callback(null, input.address, input.family);
        }) as never
      },
      (response) => {
        const chunks: Buffer[] = [];
        let size = 0;

        response.on("data", (chunk: Buffer | string) => {
          if (settled) return;
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          size += buffer.byteLength;
          if (size > MAX_BODY_BYTES) {
            response.destroy();
            finishReject(new Error("Verification response is larger than 4 KiB."));
            return;
          }
          chunks.push(buffer);
        });

        response.on("error", (error) => finishReject(error));
        response.on("end", () => {
          if (settled) return;
          settled = true;
          resolve({
            status: response.statusCode ?? 0,
            location: response.headers.location ?? null,
            body: Buffer.concat(chunks).toString("utf8")
          });
        });
      }
    );

    request.on("error", (error) => finishReject(error));
    request.end();
  });
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
  if (base.port && base.port !== "443") {
    return { verified: false, reason: "Hosted verification supports HTTPS port 443 only." };
  }

  const endpoint = new URL(VERIFY_PATH, base.origin);
  const resolver = dependencies.resolveHostname ?? defaultResolveHostname;
  const requester = dependencies.requester ?? defaultPinnedRequester;

  try {
    const pinned = await resolvePinnedAddress(endpoint.hostname, resolver);
    const response = await requester({ endpoint, ...pinned });

    if (response.status >= 300 && response.status < 400) {
      if (response.location) {
        const redirected = new URL(response.location, endpoint);
        if (redirected.hostname.toLowerCase() !== endpoint.hostname.toLowerCase()) {
          return { verified: false, reason: "Verification redirects to another hostname are not allowed." };
        }
      }
      return { verified: false, reason: "Verification redirects are not followed." };
    }

    if (response.status < 200 || response.status >= 300) {
      return { verified: false, reason: `Verification file returned HTTP ${response.status}.` };
    }

    if (Buffer.byteLength(response.body, "utf8") > MAX_BODY_BYTES) {
      return { verified: false, reason: "Verification response is larger than 4 KiB." };
    }

    if (!safeTokenEquals(response.body, input.expectedToken)) {
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
