import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  readGitHubWebhookRequest: vi.fn(),
  processGitHubWebhook: vi.fn(),
}));

vi.mock("@/lib/github-app/webhook", async () => {
  const actual = await vi.importActual<typeof import("@/lib/github-app/webhook")>("@/lib/github-app/webhook");
  return {
    ...actual,
    readGitHubWebhookRequest: mocks.readGitHubWebhookRequest,
  };
});

vi.mock("@/lib/github-app/webhook-service", async () => {
  const actual = await vi.importActual<typeof import("@/lib/github-app/webhook-service")>("@/lib/github-app/webhook-service");
  return {
    ...actual,
    processGitHubWebhook: mocks.processGitHubWebhook,
  };
});

import {
  GitHubWebhookInputError,
  type VerifiedGitHubWebhookRequest,
} from "@/lib/github-app/webhook";
import { GitHubWebhookServiceError } from "@/lib/github-app/webhook-service";
import {
  POST,
  dynamic,
  runtime,
} from "@/app/api/integrations/github/webhook/route";

const DELIVERY_ID = "11111111-1111-4111-8111-111111111111";
const SIGNATURE = `sha256=${"a".repeat(64)}`;

const verified: VerifiedGitHubWebhookRequest = {
  deliveryId: DELIVERY_ID,
  event: "push",
  rawBody: new Uint8Array([123, 125]),
  payload: {
    installation: { id: 7001 },
    repository: { id: 9001 },
    ref: "refs/heads/main",
    after: "b".repeat(40),
    deleted: false,
  },
};

function request(): Request {
  return new Request("https://scopeforge.dev/api/integrations/github/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-github-delivery": DELIVERY_ID,
      "x-github-event": "push",
      "x-hub-signature-256": SIGNATURE,
    },
    body: "{}",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.readGitHubWebhookRequest.mockResolvedValue(verified);
  mocks.processGitHubWebhook.mockResolvedValue({
    status: "ignored",
    code: "EVENT_UNSUPPORTED",
  });
});

describe("GitHub webhook public route", () => {
  it("pins the route to the Node runtime and force-dynamic execution", () => {
    expect(runtime).toBe("nodejs");
    expect(dynamic).toBe("force-dynamic");
  });

  it.each([
    ["GITHUB_WEBHOOK_HEADERS_INVALID", 400],
    ["GITHUB_WEBHOOK_SIGNATURE_INVALID", 401],
    ["GITHUB_WEBHOOK_PAYLOAD_TOO_LARGE", 413],
    ["GITHUB_WEBHOOK_PAYLOAD_INVALID", 400],
  ] as const)("maps %s before invoking the reconciliation service", async (code, status) => {
    mocks.readGitHubWebhookRequest.mockRejectedValueOnce(
      new GitHubWebhookInputError(code, status),
    );

    const response = await POST(request());

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual({ ok: false, error: code });
    expect(mocks.processGitHubWebhook).not.toHaveBeenCalled();
  });

  it("passes only the verified webhook envelope to the service and returns a bounded queued response", async () => {
    const queued = {
      status: "queued" as const,
      taskId: "22222222-2222-4222-8222-222222222222",
      executionClass: "repository_snapshot_github_public_v1" as const,
    };
    mocks.processGitHubWebhook.mockResolvedValueOnce(queued);
    const incoming = request();

    const response = await POST(incoming);
    const text = await response.text();

    expect(mocks.readGitHubWebhookRequest).toHaveBeenCalledWith(incoming);
    expect(mocks.processGitHubWebhook).toHaveBeenCalledWith(verified);
    expect(response.status).toBe(202);
    expect(JSON.parse(text)).toEqual({ ok: true, data: queued });
    expect(text).not.toContain("rawBody");
    expect(text).not.toContain(SIGNATURE);
    expect(text).not.toContain("x-hub-signature-256");
  });

  it.each([
    [{ status: "accepted" as const, code: "PING" as const }, 200],
    [{ status: "ignored" as const, code: "REPOSITORY_ARCHIVED" }, 200],
    [{ status: "replayed" as const, code: "DELIVERY_REPLAY" as const }, 200],
    [{ status: "superseded" as const, code: "AUTHORITATIVE_HEAD_ADVANCED" as const }, 200],
    [{ status: "pending" as const, code: "COALESCED" as const }, 202],
    [{ status: "runtime_unavailable" as const, code: "PUBLIC_SNAPSHOT_RUNTIME_UNAVAILABLE" as const }, 200],
  ])("uses bounded 2xx handling for %o", async (result, expectedStatus) => {
    mocks.processGitHubWebhook.mockResolvedValueOnce(result);

    const response = await POST(request());

    expect(response.status).toBe(expectedStatus);
    await expect(response.json()).resolves.toEqual({ ok: true, data: result });
  });

  it("maps a bounded service failure to a retryable generic 503", async () => {
    mocks.processGitHubWebhook.mockRejectedValueOnce(new GitHubWebhookServiceError());

    const response = await POST(request());

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "GITHUB_WEBHOOK_PROCESSING_FAILED",
    });
  });

  it("never reflects unknown provider or persistence error details", async () => {
    mocks.processGitHubWebhook.mockRejectedValueOnce(new Error("provider-secret-body"));

    const response = await POST(request());
    const text = await response.text();

    expect(response.status).toBe(503);
    expect(JSON.parse(text)).toEqual({
      ok: false,
      error: "GITHUB_WEBHOOK_PROCESSING_FAILED",
    });
    expect(text).not.toContain("provider-secret-body");
    expect(text).not.toContain(SIGNATURE);
  });
});
