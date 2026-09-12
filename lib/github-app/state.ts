import { createHmac, timingSafeEqual } from "node:crypto";
import type { GitHubConnectionState } from "./types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_STATE_AGE_SECONDS = 600;

function invalid(): never {
  throw new Error("GitHub connection state is invalid.");
}

function assertSecret(secret: string): void {
  if (secret.length < 32 || secret.length > 512) invalid();
}

function signature(payload: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(payload).digest();
}

function validPayload(value: unknown): value is GitHubConnectionState {
  if (!value || typeof value !== "object") return false;
  const payload = value as Record<string, unknown>;
  return payload.version === 1
    && typeof payload.workspaceId === "string"
    && UUID_PATTERN.test(payload.workspaceId)
    && typeof payload.userId === "string"
    && UUID_PATTERN.test(payload.userId)
    && typeof payload.nonce === "string"
    && payload.nonce.length >= 8
    && payload.nonce.length <= 128
    && Number.isInteger(payload.issuedAt)
    && Number.isInteger(payload.expiresAt)
    && Number(payload.expiresAt) - Number(payload.issuedAt) === MAX_STATE_AGE_SECONDS;
}

export function createGitHubConnectionState(
  input: { workspaceId: string; userId: string; nonce: string },
  secret: string,
  now = new Date(),
): string {
  assertSecret(secret);
  const issuedAt = Math.floor(now.getTime() / 1000);
  const state: GitHubConnectionState = {
    version: 1,
    workspaceId: input.workspaceId,
    userId: input.userId,
    nonce: input.nonce,
    issuedAt,
    expiresAt: issuedAt + MAX_STATE_AGE_SECONDS,
  };
  if (!validPayload(state)) invalid();

  const payload = Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
  return `${payload}.${signature(payload, secret).toString("base64url")}`;
}

export function verifyGitHubConnectionState(
  value: string,
  secret: string,
  now = new Date(),
): GitHubConnectionState {
  try {
    assertSecret(secret);
    const parts = value.split(".");
    if (parts.length !== 2 || !parts[0] || !parts[1]) invalid();
    const [payload, encodedSignature] = parts;
    const actual = Buffer.from(encodedSignature, "base64url");
    const expected = signature(payload, secret);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) invalid();

    const parsed: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!validPayload(parsed)) invalid();
    const nowSeconds = Math.floor(now.getTime() / 1000);
    if (parsed.issuedAt > nowSeconds + 30 || parsed.expiresAt < nowSeconds) invalid();
    return Object.freeze({ ...parsed });
  } catch {
    invalid();
  }
}
