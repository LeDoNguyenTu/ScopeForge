import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { request as httpsRequest } from "node:https";
import type { RepositorySnapshotUploadDescriptor } from "@/packages/worker-contracts";

const R2_UPLOAD_HOST_PATTERN = /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?[.][a-f0-9]{32}[.]r2[.]cloudflarestorage[.]com$/;
const R2_UPLOAD_PATH_PATTERN = /^\/repository-source\/[a-f0-9]{64}[.]tar[.]gz$/;

function assertUploadDescriptor(descriptor: RepositorySnapshotUploadDescriptor): URL {
  if (descriptor.method !== "PUT") throw new Error("Repository snapshot upload method is invalid.");
  const expiresAt = Date.parse(descriptor.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    throw new Error("Repository snapshot upload authorization is expired.");
  }
  let url: URL;
  try {
    url = new URL(descriptor.url);
  } catch {
    throw new Error("Repository snapshot upload URL is invalid.");
  }
  if (
    url.protocol !== "https:"
    || (url.port && url.port !== "443")
    || url.username
    || url.password
    || url.hash
    || !R2_UPLOAD_HOST_PATTERN.test(url.hostname.toLowerCase())
    || !R2_UPLOAD_PATH_PATTERN.test(url.pathname)
    || !url.searchParams.has("X-Amz-Signature")
  ) {
    throw new Error("Repository snapshot upload URL violates the closed R2 policy.");
  }
  return url;
}

export async function uploadRepositorySnapshotArtifact(input: {
  descriptor: RepositorySnapshotUploadDescriptor;
  artifactPath: string;
  storedArtifactBytes: number;
  signal: AbortSignal;
}): Promise<void> {
  if (input.signal.aborted) throw new DOMException("Repository artifact upload was aborted.", "AbortError");
  const url = assertUploadDescriptor(input.descriptor);
  const metadata = await stat(input.artifactPath);
  if (!metadata.isFile() || metadata.size !== input.storedArtifactBytes || metadata.size < 1) {
    throw new Error("Repository snapshot artifact size does not match upload provenance.");
  }

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const request = httpsRequest(url, {
      method: "PUT",
      headers: {
        "content-length": String(input.storedArtifactBytes),
        "content-type": "application/gzip",
        "if-none-match": "*",
      },
      agent: false,
    }, (response) => {
      response.resume();
      if (response.statusCode !== undefined && response.statusCode >= 200 && response.statusCode < 300) {
        response.once("end", () => finish(resolve));
      } else {
        response.once("end", () => finish(() => reject(new Error("Repository snapshot object upload was rejected."))));
      }
    });
    const source = createReadStream(input.artifactPath, { highWaterMark: 64 * 1024 });

    const finish = (callback: (() => void) | ((value?: never) => void)) => {
      if (settled) return;
      settled = true;
      input.signal.removeEventListener("abort", onAbort);
      source.destroy();
      callback();
    };
    const onAbort = () => {
      request.destroy(new DOMException("Repository artifact upload was aborted.", "AbortError"));
      finish(() => reject(new DOMException("Repository artifact upload was aborted.", "AbortError")));
    };
    if (input.signal.aborted) {
      onAbort();
      return;
    }
    input.signal.addEventListener("abort", onAbort, { once: true });
    request.once("error", (error) => finish(() => reject(error)));
    source.once("error", (error) => {
      request.destroy(error);
      finish(() => reject(error));
    });
    source.pipe(request);
  });
}
