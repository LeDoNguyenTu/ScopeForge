import { describe, expect, it, vi } from "vitest";
import { createWorkerHttpControlClient } from "@/packages/worker-runtime/http-control-client";

const WORKER_ID = "11111111-1111-4111-8111-111111111111";
const SECRET = "a".repeat(64);

function response(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

describe("worker HTTP control client", () => {
  it("claims with body-free authenticated HTTPS and validates an idle response", async () => {
    const fetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => response({ ok: true, data: null }));
    const client = createWorkerHttpControlClient({
      baseUrl: "https://scopeforge.dev",
      workerId: WORKER_ID,
      secret: SECRET,
      fetch,
    });

    await expect(client.claim()).resolves.toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0]!;
    expect(String(url)).toBe("https://scopeforge.dev/api/internal/workers/claim");
    expect(init).toMatchObject({ method: "POST", body: undefined, redirect: "error" });
    expect(new Headers(init?.headers).get("authorization")).toBe(`Bearer ${SECRET}`);
    expect(new Headers(init?.headers).get("x-scopeforge-worker-id")).toBe(WORKER_ID);
    expect(String(url)).not.toContain(SECRET);
  });

  it("rejects non-HTTPS origins, paths, invalid identity, and invalid credentials", () => {
    const base = { workerId: WORKER_ID, secret: SECRET };
    expect(() => createWorkerHttpControlClient({ ...base, baseUrl: "http://scopeforge.dev" })).toThrow(/HTTPS/);
    expect(() => createWorkerHttpControlClient({ ...base, baseUrl: "https://scopeforge.dev/app" })).toThrow(/origin/);
    expect(() => createWorkerHttpControlClient({ ...base, baseUrl: "https://user@scopeforge.dev" })).toThrow(/origin/);
    expect(() => createWorkerHttpControlClient({ ...base, baseUrl: "https://scopeforge.dev", workerId: "bad" })).toThrow(/identity/);
    expect(() => createWorkerHttpControlClient({ ...base, baseUrl: "https://scopeforge.dev", secret: "bad" })).toThrow(/credential/);
  });

  it("fails closed on an invalid success envelope and oversized response", async () => {
    const invalidFetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => response({ ok: true, data: null, extra: true }));
    const invalid = createWorkerHttpControlClient({
      baseUrl: "https://scopeforge.dev",
      workerId: WORKER_ID,
      secret: SECRET,
      fetch: invalidFetch,
    });
    await expect(invalid.claim()).rejects.toThrow(/response/);

    const oversizedFetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => response({ ok: true, data: null }, 200, {
      "content-length": "4194305",
    }));
    const oversized = createWorkerHttpControlClient({
      baseUrl: "https://scopeforge.dev",
      workerId: WORKER_ID,
      secret: SECRET,
      fetch: oversizedFetch,
    });
    await expect(oversized.claim()).rejects.toThrow(/response/);
  });

  it("uses dedicated Phase 11 HTTP prepare and finalize endpoints with strict response parsing", async () => {
    const requests: string[] = [];
    const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      requests.push(url);
      if (url.endsWith("/api/internal/workers/phase11-http/prepare")) {
        return response({
          ok: true,
          data: {
            taskId: WORKER_ID,
            workspaceId: "22222222-2222-4222-8222-222222222222",
            runId: "33333333-3333-4333-8333-333333333333",
            actionId: `phase11-action:${"a".repeat(64)}`,
            authorizationId: `phase11-authz:${"b".repeat(64)}`,
            authorizationSnapshotRef: "snapshot-1",
            targetNodeId: "node-1",
            target: {
              assetRef: "node-1",
              kind: "web_application",
              canonicalUrl: "https://example.com/",
              hostname: "example.com",
            },
            capabilityId: "web.http.probe.v1",
            discoveryProfile: "root-only",
            methodProfile: "GET_ONLY",
            followSameOriginRedirects: false,
            budget: {
              maxRequests: 1,
              perRequestTimeoutMs: 5000,
              totalTimeoutMs: 5000,
            },
            expiresAt: "2099-09-19T00:00:20.000Z",
          },
        });
      }
      if (url.endsWith("/api/internal/workers/phase11-http/finalize")) {
        expect(JSON.parse(String(init?.body))).toMatchObject({
          taskId: WORKER_ID,
          attemptId: "44444444-4444-4444-8444-444444444444",
          leaseToken: SECRET,
          terminal: { executionClass: "phase11_http_discovery_v1" },
        });
        return response({ ok: true, data: { outcome: "succeeded", replayed: false } });
      }
      throw new Error(`unexpected URL ${url}`);
    });

    const client = createWorkerHttpControlClient({
      baseUrl: "https://scopeforge.dev",
      workerId: WORKER_ID,
      secret: SECRET,
      expectedExecutionClass: "phase11_http_discovery_v1",
      fetch,
    });

    await expect(client.phase11HttpPrepare?.({
      taskId: WORKER_ID,
      attemptId: "44444444-4444-4444-8444-444444444444",
      leaseToken: SECRET,
    })).resolves.toMatchObject({
      taskId: WORKER_ID,
      runId: "33333333-3333-4333-8333-333333333333",
      capabilityId: "web.http.probe.v1",
      target: { canonicalUrl: "https://example.com/", hostname: "example.com" },
    });

    await expect(client.phase11HttpFinalize?.({
      taskId: WORKER_ID,
      attemptId: "44444444-4444-4444-8444-444444444444",
      leaseToken: SECRET,
      terminal: {
        schemaVersion: 1,
        taskId: WORKER_ID,
        attemptId: "44444444-4444-4444-8444-444444444444",
        executionClass: "phase11_http_discovery_v1",
        outcome: "succeeded",
        failureCode: null,
        metrics: {
          wallTimeMs: 1,
          cpuTimeMs: 0,
          peakMemoryBytes: 0,
          inputBytes: 0,
          outputBytes: 1,
        },
        result: {
          kind: "phase11_http_discovery",
          requestCount: 1,
          records: [{ routeKind: "root", status: 200, redirected: false }],
        },
      },
    })).resolves.toEqual({ outcome: "succeeded", replayed: false });

    expect(requests).toEqual([
      "https://scopeforge.dev/api/internal/workers/phase11-http/prepare",
      "https://scopeforge.dev/api/internal/workers/phase11-http/finalize",
    ]);
  });

  it("returns only the bounded server error code", async () => {
    const fetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => response({ error: { code: "WORKER_DISABLED" } }, 403));
    const client = createWorkerHttpControlClient({
      baseUrl: "https://scopeforge.dev",
      workerId: WORKER_ID,
      secret: SECRET,
      fetch,
    });
    await expect(client.claim()).rejects.toMatchObject({
      name: "WorkerHttpControlError",
      code: "WORKER_DISABLED",
      status: 403,
    });
  });
});
