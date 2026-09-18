import { describe, expect, it, vi } from "vitest";
import {
  executeHttpDiscoveryProfile,
  type HttpDiscoveryMediatorProfile,
  type HttpDiscoveryTransport,
} from "@/packages/runtime-worker-mediator/http-discovery";

const baseProfile: HttpDiscoveryMediatorProfile = {
  executionClass: "phase11_http_discovery_v1",
  target: {
    assetRef: "11111111-1111-4111-8111-111111111111" as never,
    kind: "web_application",
    canonicalUrl: "https://example.com/app",
    hostname: "example.com",
  },
  capabilityId: "web.route.discover.v1",
  discoveryProfile: "root-only",
  methodProfile: "GET_ONLY",
  followSameOriginRedirects: false,
  budget: {
    maxRequests: 12,
    perRequestTimeoutMs: 2_000,
    totalTimeoutMs: 10_000,
  },
};

function response(status = 200, headers: Record<string, string> = {}) {
  return {
    status,
    headers,
    tls: { protocol: "TLSv1.3", validFrom: null, validTo: null, subjectAltName: "DNS:example.com" },
  };
}

describe("Phase 11 HTTP discovery mediator", () => {
  it("uses only the code-owned root route for root-only discovery", async () => {
    const transport = vi.fn<HttpDiscoveryTransport>(async () => response(200, { "content-type": "text/html" }));

    const result = await executeHttpDiscoveryProfile(baseProfile, { transport });

    expect(result.status).toBe("succeeded");
    if (result.status !== "succeeded") throw new Error("expected success");
    expect(transport).toHaveBeenCalledTimes(1);
    expect(transport.mock.calls[0]?.[0]).toMatchObject({
      method: "GET",
      url: new URL("https://example.com/"),
    });
    expect(result.result).toEqual({
      kind: "phase11_http_discovery",
      requestCount: 1,
      records: [{
        routeKind: "root",
        status: 200,
        contentType: "text/html",
        redirected: false,
      }],
    });
  });

  it("uses the fixed well-known route set and falls back from HEAD only on 405 or 501", async () => {
    const transport = vi.fn<HttpDiscoveryTransport>(async (input) => {
      if (input.url.pathname === "/robots.txt" && input.method === "HEAD") return response(405);
      return response(200, { "content-type": "text/plain" });
    });

    const result = await executeHttpDiscoveryProfile({
      ...baseProfile,
      discoveryProfile: "well-known-safe",
      methodProfile: "HEAD_THEN_GET",
    }, { transport });

    expect(result.status).toBe("succeeded");
    if (result.status !== "succeeded") throw new Error("expected success");
    expect(result.result.records.map((record) => record.routeKind)).toEqual([
      "root",
      "security-txt",
      "robots",
      "sitemap",
    ]);
    expect(transport).toHaveBeenCalledTimes(5);
    expect(transport.mock.calls.map(([input]) => [input.method, input.url.pathname])).toEqual([
      ["HEAD", "/"],
      ["HEAD", "/.well-known/security.txt"],
      ["HEAD", "/robots.txt"],
      ["GET", "/robots.txt"],
      ["HEAD", "/sitemap.xml"],
    ]);
  });

  it("never follows a cross-host redirect", async () => {
    const transport = vi.fn<HttpDiscoveryTransport>(async () => response(302, {
      location: "https://attacker.invalid/next",
    }));

    const result = await executeHttpDiscoveryProfile({
      ...baseProfile,
      followSameOriginRedirects: true,
    }, { transport });

    expect(result.status).toBe("succeeded");
    if (result.status !== "succeeded") throw new Error("expected success");
    expect(transport).toHaveBeenCalledTimes(1);
    expect(result.result.records[0]).toMatchObject({
      routeKind: "root",
      status: 302,
      redirected: false,
      redirectBlockedReason: "CROSS_HOST",
    });
  });

  it("follows at most one same-origin redirect per fixed route when enabled", async () => {
    const transport = vi.fn<HttpDiscoveryTransport>(async (input) => {
      if (input.url.pathname === "/") return response(302, { location: "/home" });
      return response(200, { "content-type": "text/html" });
    });

    const result = await executeHttpDiscoveryProfile({
      ...baseProfile,
      followSameOriginRedirects: true,
    }, { transport });

    expect(result.status).toBe("succeeded");
    if (result.status !== "succeeded") throw new Error("expected success");
    expect(transport).toHaveBeenCalledTimes(2);
    expect(transport.mock.calls[1]?.[0].url.pathname).toBe("/home");
    expect(result.result.records[0]).toMatchObject({
      routeKind: "root",
      status: 200,
      redirected: true,
    });
  });

  it("stops before the first request when cancellation is authoritative", async () => {
    const transport = vi.fn<HttpDiscoveryTransport>(async () => response());

    const result = await executeHttpDiscoveryProfile(baseProfile, {
      transport,
      isCancelled: async () => true,
    });

    expect(result.status).toBe("cancelled");
    expect(transport).not.toHaveBeenCalled();
  });

  it("fails closed when the profile budget cannot cover the fixed route plan", async () => {
    const transport = vi.fn<HttpDiscoveryTransport>(async () => response());

    const result = await executeHttpDiscoveryProfile({
      ...baseProfile,
      discoveryProfile: "well-known-safe",
      methodProfile: "HEAD_THEN_GET",
      followSameOriginRedirects: true,
      budget: { ...baseProfile.budget, maxRequests: 3 },
    }, { transport });

    expect(result).toEqual({
      status: "failed",
      failureCode: "HTTP_DISCOVERY_REQUEST_BUDGET",
      requestCount: 0,
    });
    expect(transport).not.toHaveBeenCalled();
  });
});
