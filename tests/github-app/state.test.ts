import { describe, expect, it } from "vitest";
import { createGitHubConnectionState, verifyGitHubConnectionState } from "@/lib/github-app/state";

const secret = "0123456789abcdef0123456789abcdef";
const workspaceId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const now = new Date("2026-09-10T07:00:00.000Z");

describe("GitHub connection signed state", () => {
  it("round-trips a user/workspace-bound state for ten minutes", () => {
    const value = createGitHubConnectionState({ workspaceId, userId, nonce: "nonce-1234567890" }, secret, now);
    const parsed = verifyGitHubConnectionState(value, secret, now);

    expect(parsed).toEqual({
      version: 1,
      workspaceId,
      userId,
      nonce: "nonce-1234567890",
      issuedAt: Math.floor(now.getTime() / 1000),
      expiresAt: Math.floor(now.getTime() / 1000) + 600,
    });
  });

  it("rejects tampering", () => {
    const value = createGitHubConnectionState({ workspaceId, userId, nonce: "nonce-1234567890" }, secret, now);
    const [payload, signature] = value.split(".");
    const tampered = `${payload.slice(0, -1)}A.${signature}`;
    expect(() => verifyGitHubConnectionState(tampered, secret, now)).toThrow("GitHub connection state is invalid.");
  });

  it("rejects expired state", () => {
    const value = createGitHubConnectionState({ workspaceId, userId, nonce: "nonce-1234567890" }, secret, now);
    const later = new Date(now.getTime() + 601_000);
    expect(() => verifyGitHubConnectionState(value, secret, later)).toThrow("GitHub connection state is invalid.");
  });

  it("rejects malformed payloads and wrong secrets", () => {
    expect(() => verifyGitHubConnectionState("not-a-state", secret, now)).toThrow("GitHub connection state is invalid.");
    const value = createGitHubConnectionState({ workspaceId, userId, nonce: "nonce-1234567890" }, secret, now);
    expect(() => verifyGitHubConnectionState(value, "abcdef0123456789abcdef0123456789", now)).toThrow("GitHub connection state is invalid.");
  });
});
