import { createHash } from "node:crypto";
import { open, rm } from "node:fs/promises";

const MAX_ARTIFACT_BYTES = 335_544_320;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const SNAPSHOT_PATH_PATTERN = /^\/repository-source\/[a-f0-9]{64}[.]tar[.]gz$/;
const R2_HOST_SUFFIX = ".r2.cloudflarestorage.com";
const SIGNATURE_PATTERN = /^[a-f0-9]{64}$/;

export interface RepositoryScanDownloadDescriptor {
  method: "GET";
  url: string;
  expiresAt: string;
}

export interface RepositoryScanArtifactDownloadInput {
  descriptor: RepositoryScanDownloadDescriptor;
  expectedHost: string;
  expectedBytes: number;
  expectedDigest: string;
  destinationPath: string;
  signal: AbortSignal;
}

export interface RepositoryScanDownloadDependencies {
  fetch?: typeof fetch;
}

function abortError(): DOMException {
  return new DOMException("Repository scan artifact download was aborted.", "AbortError");
}

function validateInput(input: RepositoryScanArtifactDownloadInput): URL {
  if (input.signal.aborted) throw abortError();
  if (input.descriptor.method !== "GET") throw new Error("Repository scan artifact descriptor must use GET.");
  if (!Number.isSafeInteger(input.expectedBytes)
      || input.expectedBytes < 1
      || input.expectedBytes > MAX_ARTIFACT_BYTES) {
    throw new Error("Repository scan artifact byte count is outside the allowed boundary.");
  }
  if (!SHA256_PATTERN.test(input.expectedDigest)) {
    throw new Error("Repository scan artifact digest is invalid.");
  }
  if (!input.expectedHost.endsWith(R2_HOST_SUFFIX)
      || input.expectedHost.length <= R2_HOST_SUFFIX.length) {
    throw new Error("Repository scan artifact host is invalid.");
  }

  let url: URL;
  try {
    url = new URL(input.descriptor.url);
  } catch {
    throw new Error("Repository scan artifact descriptor URL is invalid.");
  }
  const expiresAt = new Date(input.descriptor.expiresAt).getTime();
  const queryExpiry = url.searchParams.get("X-Amz-Expires");
  const signature = url.searchParams.get("X-Amz-Signature");
  if (url.protocol !== "https:"
      || (url.port !== "" && url.port !== "443")
      || url.hostname !== input.expectedHost
      || url.username !== ""
      || url.password !== ""
      || url.hash !== ""
      || !SNAPSHOT_PATH_PATTERN.test(url.pathname)
      || !Number.isFinite(expiresAt)
      || queryExpiry === null
      || !/^[1-9][0-9]{0,2}$/.test(queryExpiry)
      || Number(queryExpiry) > 120
      || signature === null
      || !SIGNATURE_PATTERN.test(signature)) {
    throw new Error("Repository scan artifact descriptor violates the fixed R2 policy.");
  }
  return url;
}

function validateContentLength(response: Response, expectedBytes: number): void {
  const contentLength = response.headers.get("content-length");
  if (contentLength === null) return;
  if (!/^(0|[1-9][0-9]*)$/.test(contentLength)
      || Number(contentLength) !== expectedBytes) {
    throw new Error("Repository scan artifact Content-Length does not match immutable provenance.");
  }
}

export async function downloadRepositoryScanArtifact(
  input: RepositoryScanArtifactDownloadInput,
  dependencies: RepositoryScanDownloadDependencies = {},
): Promise<void> {
  validateInput(input);
  const fetchImpl = dependencies.fetch ?? globalThis.fetch;
  let handle: Awaited<ReturnType<typeof open>> | null = null;

  try {
    const response = await fetchImpl(input.descriptor.url, {
      method: "GET",
      redirect: "manual",
      signal: input.signal,
      headers: { accept: "application/gzip" },
    });
    if (response.status !== 200 || response.body === null) {
      throw new Error("Repository scan artifact download failed without following redirects.");
    }
    validateContentLength(response, input.expectedBytes);

    handle = await open(input.destinationPath, "wx", 0o600);
    const reader = response.body.getReader();
    const hash = createHash("sha256");
    let observedBytes = 0;

    while (true) {
      if (input.signal.aborted) {
        await reader.cancel().catch(() => undefined);
        throw abortError();
      }
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array)) {
        throw new Error("Repository scan artifact stream returned an invalid chunk.");
      }
      observedBytes += value.byteLength;
      if (observedBytes > input.expectedBytes) {
        await reader.cancel().catch(() => undefined);
        throw new Error("Repository scan artifact stream exceeds immutable provenance.");
      }
      hash.update(value);
      await handle.write(value);
    }

    if (observedBytes !== input.expectedBytes) {
      throw new Error("Repository scan artifact stream is truncated.");
    }
    if (hash.digest("hex") !== input.expectedDigest) {
      throw new Error("Repository scan artifact digest does not match immutable provenance.");
    }
    await handle.sync();
    await handle.close();
    handle = null;
  } catch (error) {
    if (handle !== null) await handle.close().catch(() => undefined);
    await rm(input.destinationPath, { force: true }).catch(() => undefined);
    if (input.signal.aborted && !(error instanceof DOMException && error.name === "AbortError")) {
      throw abortError();
    }
    throw error;
  }
}