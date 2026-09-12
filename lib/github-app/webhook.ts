import { createHmac, timingSafeEqual } from "node:crypto";
import { getGitHubAppConfig } from "./config";

export const MAX_GITHUB_WEBHOOK_BODY_BYTES = 10 * 1024 * 1024;

const SIGNATURE_PATTERN = /^sha256=([a-fA-F0-9]{64})$/;
const DELIVERY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EVENT_PATTERN = /^[A-Za-z0-9_.-]{1,64}$/;
const CONTENT_LENGTH_PATTERN = /^[0-9]+$/;

export type GitHubWebhookInputErrorCode =
  | "GITHUB_WEBHOOK_SIGNATURE_INVALID"
  | "GITHUB_WEBHOOK_HEADERS_INVALID"
  | "GITHUB_WEBHOOK_PAYLOAD_INVALID"
  | "GITHUB_WEBHOOK_PAYLOAD_TOO_LARGE";

export class GitHubWebhookInputError extends Error {
  constructor(
    public readonly code: GitHubWebhookInputErrorCode,
    public readonly status: 400 | 401 | 413,
  ) {
    super(code);
    this.name = "GitHubWebhookInputError";
  }
}

export interface VerifiedGitHubWebhookRequest {
  deliveryId: string;
  event: string;
  rawBody: Uint8Array;
  payload: Record<string, unknown>;
}

function fail(
  code: GitHubWebhookInputErrorCode,
  status: 400 | 401 | 413,
): GitHubWebhookInputError {
  return new GitHubWebhookInputError(code, status);
}

function jsonCompatibleContentType(value: string | null): boolean {
  if (!value) return false;
  const mediaType = value.split(";", 1)[0]?.trim().toLowerCase();
  return mediaType === "application/json" || Boolean(mediaType?.endsWith("+json"));
}

async function readBoundedRawBody(request: Request): Promise<Uint8Array> {
  if (!request.body) return new Uint8Array();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.byteLength;
      if (totalBytes > MAX_GITHUB_WEBHOOK_BODY_BYTES) {
        throw fail("GITHUB_WEBHOOK_PAYLOAD_TOO_LARGE", 413);
      }
      chunks.push(value);
    }
  } catch (error) {
    try {
      await reader.cancel();
    } catch {
      // Preserve the original read or validation failure.
    }
    throw error;
  } finally {
    reader.releaseLock();
  }

  const rawBody = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    rawBody.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return rawBody;
}

export function verifyGitHubWebhookSignature(
  rawBody: Uint8Array,
  signatureHeader: string,
  secret: string,
): boolean {
  if (typeof secret !== "string" || secret.length < 32 || secret.length > 512) return false;
  const match = SIGNATURE_PATTERN.exec(signatureHeader);
  if (!match) return false;

  const supplied = Buffer.from(match[1], "hex");
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export async function readGitHubWebhookRequest(
  request: Request,
  webhookSecret: string = getGitHubAppConfig().webhookSecret,
): Promise<VerifiedGitHubWebhookRequest> {
  const contentType = request.headers.get("content-type");
  const deliveryId = request.headers.get("x-github-delivery")?.trim() ?? "";
  const event = request.headers.get("x-github-event")?.trim() ?? "";
  const signature = request.headers.get("x-hub-signature-256")?.trim() ?? "";

  if (
    !jsonCompatibleContentType(contentType)
    || !DELIVERY_PATTERN.test(deliveryId)
    || !EVENT_PATTERN.test(event)
    || !SIGNATURE_PATTERN.test(signature)
  ) {
    throw fail("GITHUB_WEBHOOK_HEADERS_INVALID", 400);
  }

  const declaredLength = request.headers.get("content-length")?.trim() ?? null;
  if (declaredLength !== null) {
    if (!CONTENT_LENGTH_PATTERN.test(declaredLength)) {
      throw fail("GITHUB_WEBHOOK_HEADERS_INVALID", 400);
    }
    const length = Number(declaredLength);
    if (!Number.isSafeInteger(length)) {
      throw fail("GITHUB_WEBHOOK_HEADERS_INVALID", 400);
    }
    if (length > MAX_GITHUB_WEBHOOK_BODY_BYTES) {
      throw fail("GITHUB_WEBHOOK_PAYLOAD_TOO_LARGE", 413);
    }
  }

  const rawBody = await readBoundedRawBody(request);
  if (!verifyGitHubWebhookSignature(rawBody, signature, webhookSecret)) {
    throw fail("GITHUB_WEBHOOK_SIGNATURE_INVALID", 401);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(rawBody));
  } catch {
    throw fail("GITHUB_WEBHOOK_PAYLOAD_INVALID", 400);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw fail("GITHUB_WEBHOOK_PAYLOAD_INVALID", 400);
  }

  return Object.freeze({
    deliveryId,
    event,
    rawBody,
    payload: parsed as Record<string, unknown>,
  });
}
