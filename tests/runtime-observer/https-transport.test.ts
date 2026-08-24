import { describe, expect, it, vi } from "vitest";
import {
  buildPinnedHttpsRequestOptions,
  requestPinnedHttps,
  type RuntimeRequester,
  type RuntimeTransportResponse,
} from "@/packages/runtime-observer";

const response: RuntimeTransportResponse = {
  status: 302,
  headers: { location: "/next" },
  tls: {
    protocol: "TLSv1.3",
    validFrom: "Jan 01 00:00:00 2026 GMT",
    validTo: "Jan 01 00:00:00 2027 GMT",
    subjectAltName: "DNS:example.com",
  },
};

describe("pinned HTTPS transport", () => {
  it("builds a GET-only request pinned to the validated address while preserving SNI", async () => {
    const options = buildPinnedHttpsRequestOptions({
      url: new URL("https://example.com/app?view=1"),
      address: "1.1.1.1",
      family: 4,
      timeoutMs: 3_000,
    });

    expect(options.method).toBe("GET");
    expect(options.agent).toBe(false);
    expect(options.hostname).toBe("example.com");
    expect(options.servername).toBe("example.com");
    expect(options.port).toBe(443);
    expect(options.path).toBe("/app?view=1");
    expect(options.timeout).toBe(3_000);
    expect(options.headers).toEqual({
      accept: "*/*",
      "user-agent": "ScopeForge-RuntimeObserver/0.1",
    });

    const lookup = options.lookup;
    expect(typeof lookup).toBe("function");

    await new Promise<void>((resolve, reject) => {
      (lookup as NonNullable<typeof lookup>)("example.com", {}, (error, address, family) => {
        if (error) {
          reject(error);
          return;
        }
        expect(address).toBe("1.1.1.1");
        expect(family).toBe(4);
        resolve();
      });
    });
  });

  it("freshly resolves and pins each request before calling the requester", async () => {
    const resolver = {
      resolve: vi.fn(async () => ["8.8.8.8", "1.1.1.1"]),
    };
    const requester = vi.fn(async (_options: Parameters<RuntimeRequester>[0]) => response);

    await requestPinnedHttps(
      { url: new URL("https://example.com/app"), timeoutMs: 2_000 },
      { resolver, requester },
    );
    await requestPinnedHttps(
      { url: new URL("https://example.com/next"), timeoutMs: 2_000 },
      { resolver, requester },
    );

    expect(resolver.resolve).toHaveBeenCalledTimes(2);
    expect(requester).toHaveBeenCalledTimes(2);
    expect(requester.mock.calls[0]?.[0].servername).toBe("example.com");
    expect(requester.mock.calls[0]?.[0].method).toBe("GET");
  });

  it("returns redirects without following them automatically", async () => {
    const resolver = { resolve: vi.fn(async () => ["1.1.1.1"]) };
    const requester = vi.fn(async (_options: Parameters<RuntimeRequester>[0]) => response);

    await expect(
      requestPinnedHttps(
        { url: new URL("https://example.com/app"), timeoutMs: 1_000 },
        { resolver, requester },
      ),
    ).resolves.toEqual(response);

    expect(requester).toHaveBeenCalledTimes(1);
  });
});
