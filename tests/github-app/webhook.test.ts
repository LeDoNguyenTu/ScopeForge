import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  GitHubWebhookInputError,
  MAX_GITHUB_WEBHOOK_BODY_BYTES,
  readGitHubWebhookRequest,
  verifyGitHubWebhookSignature,
} from "@/lib/github-app/webhook";

const secret = "webhook-secret-0123456789abcdef0123456789";
const deliveryId = "4f7f17ee-9ea6-4c22-a6bd-95a3f77198e2";

function signatureFor(raw: Uint8Array): string {
  return `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;
}

function requestFor(
  rawText: string,
  overrides: Record<string, string | undefined> = {},
): Request {
  const raw = new TextEncoder().encode(rawText);
  const headers = new Headers({
    "content-type": "application/json",
    "x-github-delivery": deliveryId,
    "x-github-event": "push",
    "x-hub-signature-256": signatureFor(raw),
  });
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) headers.delete(key);
    else headers.set(key, value);
  }
  return new Request("https://scopeforge.dev/api/integrations/github/webhook", {
    method: "POST",
    headers,
    body: raw,
  });
}

async function expectWebhookError(
  promise: Promise<unknown>,
  code: string,
  status: number,
): Promise<void> {
  try {
    await promise;
    throw new Error("Expected webhook input error.");
  } catch (error) {
    expect(error).toBeInstanceOf(GitHubWebhookInputError);
    expect(error).toMatchObject({ code, status });
  }
}

describe("GitHub webhook trust boundary", () => {
  it("verifies HMAC-SHA256 over the exact raw bytes", () => {
    const raw = new TextEncoder().encode('{"zen":"keep it logically awesome"}');
    const signature = signatureFor(raw);

    expect(verifyGitHubWebhookSignature(raw, signature, secret)).toBe(true);
    expect(
      verifyGitHubWebhookSignature(
        new TextEncoder().encode('{"zen":"changed"}'),
        signature,
        secret,
      ),
    ).toBe(false);
  });

  it("rejects malformed signatures without throwing crypto length errors", () => {
    const raw = new TextEncoder().encode("{}");
    expect(verifyGitHubWebhookSignature(raw, "sha256=abc", secret)).toBe(false);
    expect(verifyGitHubWebhookSignature(raw, "sha1=00", secret)).toBe(false);
    expect(verifyGitHubWebhookSignature(raw, "", secret)).toBe(false);
  });

  it("verifies the signature before parsing JSON", async () => {
    const request = requestFor("not-json", {
      "x-hub-signature-256": `sha256=${"0".repeat(64)}`,
    });

    await expectWebhookError(
      readGitHubWebhookRequest(request, secret),
      "GITHUB_WEBHOOK_SIGNATURE_INVALID",
      401,
    );
  });

  it("returns only bounded verified request metadata plus parsed payload", async () => {
    const request = requestFor('{"after":"0123456789012345678901234567890123456789"}');
    const result = await readGitHubWebhookRequest(request, secret);

    expect(result.deliveryId).toBe(deliveryId);
    expect(result.event).toBe("push");
    expect(result.payload).toEqual({ after: "0123456789012345678901234567890123456789" });
    expect(new TextDecoder().decode(result.rawBody)).toBe(
      '{"after":"0123456789012345678901234567890123456789"}',
    );
  });

  it("rejects a declared body larger than 10 MiB before parsing", async () => {
    const request = requestFor("{}", {
      "content-length": String(MAX_GITHUB_WEBHOOK_BODY_BYTES + 1),
    });

    await expectWebhookError(
      readGitHubWebhookRequest(request, secret),
      "GITHUB_WEBHOOK_PAYLOAD_TOO_LARGE",
      413,
    );
  });

  it("rejects an actually oversized body even when Content-Length is absent", async () => {
    const rawText = "x".repeat(MAX_GITHUB_WEBHOOK_BODY_BYTES + 1);
    const request = requestFor(rawText, { "content-length": undefined });

    await expectWebhookError(
      readGitHubWebhookRequest(request, secret),
      "GITHUB_WEBHOOK_PAYLOAD_TOO_LARGE",
      413,
    );
  });

  it.each([
    ["missing content type", { "content-type": undefined }, "GITHUB_WEBHOOK_HEADERS_INVALID", 400],
    ["non-json content type", { "content-type": "text/plain" }, "GITHUB_WEBHOOK_HEADERS_INVALID", 400],
    ["missing delivery", { "x-github-delivery": undefined }, "GITHUB_WEBHOOK_HEADERS_INVALID", 400],
    ["invalid delivery", { "x-github-delivery": "not-a-uuid" }, "GITHUB_WEBHOOK_HEADERS_INVALID", 400],
    ["missing event", { "x-github-event": undefined }, "GITHUB_WEBHOOK_HEADERS_INVALID", 400],
    ["invalid event", { "x-github-event": "push event" }, "GITHUB_WEBHOOK_HEADERS_INVALID", 400],
  ])("rejects %s", async (_name, overrides, code, status) => {
    await expectWebhookError(
      readGitHubWebhookRequest(requestFor("{}", overrides as Record<string, string | undefined>), secret),
      code as string,
      status as number,
    );
  });
});
