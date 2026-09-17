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
