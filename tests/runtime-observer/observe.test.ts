import { describe, expect, it, vi } from "vitest";
import { assetRef } from "@/packages/security-domain";
import {
  observeRuntimeTarget,
  type AuthorizedRuntimeTarget,
  type RuntimeObservationBudget,
  type RuntimeTransport,
  type RuntimeTransportResponse,
} from "@/packages/runtime-observer";

function target(): AuthorizedRuntimeTarget {
  return {
    assetRef: assetRef("asset-1"),
    kind: "web_application",
    canonicalUrl: "https://example.com/app",
    hostname: "example.com",
  };
}

function budget(overrides: Partial<RuntimeObservationBudget> = {}): RuntimeObservationBudget {
  return {
    maxRequests: 4,
    maxRedirects: 3,
    perRequestTimeoutMs: 5_000,
    totalTimeoutMs: 15_000,
    maxObservationBytes: 65_536,
    ...overrides,
  };
}

function response(
  status: number,
  headers: RuntimeTransportResponse["headers"] = {},
): RuntimeTransportResponse {
  return {
    status,
    headers,
    tls: {
      protocol: "TLSv1.3",
      validFrom: "Jan 01 00:00:00 2026 GMT",
      validTo: "Jan 01 00:00:00 2027 GMT",
      subjectAltName: "DNS:example.com",
    },
  };
}

describe("observeRuntimeTarget", () => {
  it("collects one successful passive response", async () => {
    const transport = vi.fn(async () => response(200));

    const result = await observeRuntimeTarget(target(), budget(), { transport });

    expect(result.status).toBe("succeeded");
    expect(result.requestCount).toBe(1);
    expect(result.redirectCount).toBe(0);
    expect(result.observations).toContainEqual({
      kind: "http-status",
      url: "https://example.com/app",
      status: 200,
    });
  });

  it("follows one same-host redirect with a fresh transport call", async () => {
    const responses = [response(302, { location: "/next" }), response(200)];
    const transport = vi.fn<RuntimeTransport>(async () => responses.shift() ?? response(500));

    const result = await observeRuntimeTarget(target(), budget(), { transport });

    expect(result.status).toBe("succeeded");
    expect(result.requestCount).toBe(2);
    expect(result.redirectCount).toBe(1);
    expect(transport).toHaveBeenCalledTimes(2);
    expect(result.observations).toContainEqual({
      kind: "redirect",
      from: "https://example.com/app",
      toHost: "example.com",
      followed: true,
    });
  });

  it("does not persist query secrets in redirect source observations", async () => {
    const transport = vi.fn(async () => response(302, { location: "/next" }));
    const targetWithSecretQuery = {
      ...target(),
      canonicalUrl: "https://example.com/app?token=super-secret",
    };

    const result = await observeRuntimeTarget(
      targetWithSecretQuery,
      budget({ maxRedirects: 0 }),
      { transport },
    );

    expect(result.observations).toContainEqual({
      kind: "redirect",
      from: "https://example.com/app",
      toHost: "example.com",
      followed: false,
      reason: "REDIRECT_LIMIT",
    });
    expect(JSON.stringify(result.observations)).not.toContain("super-secret");
  });

  it("records but never follows a cross-host redirect", async () => {
    const transport = vi.fn(async () => response(302, { location: "https://attacker.example/next" }));

    const result = await observeRuntimeTarget(target(), budget(), { transport });

    expect(result.status).toBe("succeeded");
    expect(transport).toHaveBeenCalledTimes(1);
    expect(result.observations).toContainEqual({
      kind: "redirect",
      from: "https://example.com/app",
      toHost: "attacker.example",
      followed: false,
      reason: "CROSS_HOST",
    });
  });

  it("does not follow a redirect when the redirect budget is exhausted", async () => {
    const transport = vi.fn(async () => response(302, { location: "/next" }));

    const result = await observeRuntimeTarget(target(), budget({ maxRedirects: 0 }), { transport });

    expect(result.status).toBe("succeeded");
    expect(transport).toHaveBeenCalledTimes(1);
    expect(result.observations).toContainEqual({
      kind: "redirect",
      from: "https://example.com/app",
      toHost: "example.com",
      followed: false,
      reason: "REDIRECT_LIMIT",
    });
  });

  it("does not follow a redirect when the request budget is exhausted", async () => {
    const transport = vi.fn(async () => response(302, { location: "/next" }));

    const result = await observeRuntimeTarget(target(), budget({ maxRequests: 1 }), { transport });

    expect(result.status).toBe("succeeded");
    expect(transport).toHaveBeenCalledTimes(1);
    expect(result.observations).toContainEqual({
      kind: "redirect",
      from: "https://example.com/app",
      toHost: "example.com",
      followed: false,
      reason: "REQUEST_LIMIT",
    });
  });

  it("cancels before any DNS or transport work", async () => {
    const transport = vi.fn(async () => response(200));

    const result = await observeRuntimeTarget(target(), budget(), {
      transport,
      isCancelled: () => true,
    });

    expect(result.status).toBe("cancelled");
    expect(result.requestCount).toBe(0);
    expect(transport).not.toHaveBeenCalled();
  });

  it("cancels before following an allowed redirect", async () => {
    const transport = vi.fn(async () => response(302, { location: "/next" }));
    const states = [false, false, true];

    const result = await observeRuntimeTarget(target(), budget(), {
      transport,
      isCancelled: () => states.shift() ?? true,
    });

    expect(result.status).toBe("cancelled");
    expect(result.requestCount).toBe(1);
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("surfaces per-request timeout with a stable failure code", async () => {
    const timeout = Object.assign(new Error("socket timed out"), { name: "TimeoutError" });
    const transport = vi.fn(async () => Promise.reject(timeout));

    const result = await observeRuntimeTarget(target(), budget(), { transport });

    expect(result.status).toBe("failed");
    expect(result.failureCode).toBe("REQUEST_TIMEOUT");
  });

  it("limits each request timeout to the remaining total runtime budget", async () => {
    const transport = vi.fn(async () => response(200));
    const times = [0, 14_000, 14_000];

    await observeRuntimeTarget(target(), budget(), {
      transport,
      now: () => times.shift() ?? 14_000,
    });

    expect(transport).toHaveBeenCalledWith({
      url: expect.any(URL),
      timeoutMs: 1_000,
    });
  });

  it("reports total timeout when the remaining total budget expires first", async () => {
    const timeout = Object.assign(new Error("deadline reached"), { name: "TimeoutError" });
    const transport = vi.fn(async () => Promise.reject(timeout));
    const times = [0, 14_000];

    const result = await observeRuntimeTarget(target(), budget(), {
      transport,
      now: () => times.shift() ?? 14_000,
    });

    expect(result.status).toBe("failed");
    expect(result.failureCode).toBe("TOTAL_TIMEOUT");
    expect(transport).toHaveBeenCalledWith({
      url: expect.any(URL),
      timeoutMs: 1_000,
    });
  });

  it("fails on total timeout before starting another request", async () => {
    const transport = vi.fn(async () => response(200));
    const times = [0, 15_001];

    const result = await observeRuntimeTarget(target(), budget(), {
      transport,
      now: () => times.shift() ?? 15_001,
    });

    expect(result.status).toBe("failed");
    expect(result.failureCode).toBe("TOTAL_TIMEOUT");
    expect(transport).not.toHaveBeenCalled();
  });
});
