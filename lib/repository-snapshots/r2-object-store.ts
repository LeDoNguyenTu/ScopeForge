import type {
  RepositorySnapshotObjectStore,
  RepositorySnapshotUploadDescriptor,
} from "./object-store";
import {
  assertRepositorySnapshotObjectKey,
  createPresignedR2PutUrl,
  createSignedR2Request,
  type R2SigningCredentials,
} from "./r2-signature-v4";

const MAX_UPLOAD_AUTHORIZATION_MS = 360_000;
const MAX_STORED_ARTIFACT_BYTES = 335_544_320;

type FetchLike = typeof fetch;

export interface R2RepositorySnapshotObjectStoreDependencies {
  config: R2SigningCredentials;
  fetch?: FetchLike;
  now?: () => Date;
}

function requestHeaders(headers: Readonly<Record<string, string>>): HeadersInit {
  const { host: _host, ...transportHeaders } = headers;
  return transportHeaders;
}

function validContentLength(value: string | null): number {
  if (value === null || !/^(0|[1-9][0-9]*)$/.test(value)) {
    throw new Error("R2 object response content length is invalid.");
  }
  const size = Number(value);
  if (!Number.isSafeInteger(size) || size < 0 || size > MAX_STORED_ARTIFACT_BYTES) {
    throw new Error("R2 object response content length exceeds the repository snapshot bound.");
  }
  return size;
}

export function createR2RepositorySnapshotObjectStore(
  dependencies: R2RepositorySnapshotObjectStoreDependencies,
): RepositorySnapshotObjectStore {
  const fetchImpl = dependencies.fetch ?? globalThis.fetch;
  const now = dependencies.now ?? (() => new Date());

  async function signedRequest(method: "HEAD" | "DELETE", objectKey: string): Promise<Response> {
    assertRepositorySnapshotObjectKey(objectKey);
    const signed = createSignedR2Request({
      credentials: dependencies.config,
      method,
      objectKey,
      now: now(),
    });
    return fetchImpl(signed.url, {
      method,
      headers: requestHeaders(signed.headers),
      redirect: "manual",
    });
  }

  return Object.freeze({
    async createAttemptUpload(input): Promise<RepositorySnapshotUploadDescriptor> {
      assertRepositorySnapshotObjectKey(input.objectKey);
      const issuedAt = now();
      const expiresAtMs = input.expiresAt.getTime();
      if (!Number.isFinite(issuedAt.getTime()) || !Number.isFinite(expiresAtMs)) {
        throw new Error("Repository snapshot upload timing is invalid.");
      }
      const remainingMs = expiresAtMs - issuedAt.getTime();
      if (remainingMs < 1_000 || remainingMs > MAX_UPLOAD_AUTHORIZATION_MS) {
        throw new Error("Repository snapshot upload authorization exceeds the allowed lifetime.");
      }
      const expiresInSeconds = Math.floor(remainingMs / 1_000);
      const effectiveExpiry = new Date(issuedAt.getTime() + expiresInSeconds * 1_000);
      const url = createPresignedR2PutUrl({
        credentials: dependencies.config,
        objectKey: input.objectKey,
        expiresInSeconds,
        now: issuedAt,
      });
      return Object.freeze({
        method: "PUT",
        url,
        expiresAt: effectiveExpiry.toISOString(),
      });
    },

    async headObject(objectKey) {
      const response = await signedRequest("HEAD", objectKey);
      if (response.status === 404) {
        return Object.freeze({ exists: false, size: null });
      }
      if (response.status !== 200) {
        throw new Error(`R2 object HEAD failed with status ${response.status}.`);
      }
      return Object.freeze({
        exists: true,
        size: validContentLength(response.headers.get("content-length")),
      });
    },

    async deleteObject(objectKey) {
      const response = await signedRequest("DELETE", objectKey);
      if (response.status === 404 || response.status === 200 || response.status === 204) {
        return;
      }
      throw new Error(`R2 object DELETE failed with status ${response.status}.`);
    },
  });
}
