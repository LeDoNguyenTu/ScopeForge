import { describe, expect, it, vi } from "vitest";
import {
  buildPinnedHttpsRequestOptions,
  requestPinnedHttps,
  PASSIVE_RUNTIME_USER_AGENT,
  SCOPEFORGE_SYNTHETIC_ORIGIN,
  type RuntimeNetworkResponse,
  type RuntimeRequester,
  type TrustedRuntimeRequestPlan,
} from "@/packages/runtime-network";

const response: RuntimeNetworkResponse = {
  status: 302,
  headers: { location: "/next" },
  tls: {
    protocol: "TLSv1.3",
    validFrom: "Jan 01 00:00:00 2026 GMT",
    validTo: "Jan 01 00:00:00 2027 GMT",
    subjectAltName: "DNS:example.com",
  },
};

function passivePlan(url = "https://example.com/app?view=1", timeoutMs = 3_000): TrustedRuntimeRequestPlan {
  return {
    method: "GET",
    url: new URL(url),
    timeoutMs,
    headers: {
      accept: "*/*",
      "user-agent": PASSIVE_RUNTIME_USER_AGENT,
      origin: undefined,
    },
  };
}

describe("trusted runtime HTTPS transport", () => {
  it("builds a GET-only request pinned to the validated address while preserving SNI", async () => {
    const options = buildPinnedHttpsRequestOptions({
      plan: passivePlan(),
      address: "1.1.1.1",
      family: 4,
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

  it("rejects request plans outside the trusted Origin contract", () => {
    const unsafe = {
      ...passivePlan("https://example.com/app", 1_000),
      headers: {
        accept: "*/*",
        "user-agent": PASSIVE_RUNTIME_USER_AGENT,
        origin: "https://evil.example",
      },
    } as unknown as TrustedRuntimeRequestPlan;

    expect(() => buildPinnedHttpsRequestOptions({
      plan: unsafe,
      address: "1.1.1.1",
      family: 4,
    })).toThrow(/origin/i);
  });

  it("allows only the fixed ScopeForge synthetic active Origin", () => {
    const active = {
      ...passivePlan("https://example.com/app", 1_000),
      headers: {
        accept: "*/*",
        "user-agent": "ScopeForge-RuntimeValidator/0.1",
        origin: SCOPEFORGE_SYNTHETIC_ORIGIN,
      },
    } as TrustedRuntimeRequestPlan;

    const options = buildPinnedHttpsRequestOptions({
      plan: active,
      address: "1.1.1.1",
      family: 4,
    });

    expect(options.headers).toEqual({
      accept: "*/*",
      "user-agent": "ScopeForge-RuntimeValidator/0.1",
      origin: "https://scopeforge.invalid",
    });
  });

  it("freshly resolves and pins each request before calling the requester", async () => {
    const resolver = {
      resolve: vi.fn(async () => ["8.8.8.8", "1.1.1.1"]),
    };
    const requester = vi.fn(async (_options: Parameters<RuntimeRequester>[0]) => response);

    await requestPinnedHttps(passivePlan("https://example.com/app", 2_000), { resolver, requester });
    await requestPinnedHttps(passivePlan("https://example.com/next", 2_000), { resolver, requester });

    expect(resolver.resolve).toHaveBeenCalledTimes(2);
    expect(requester).toHaveBeenCalledTimes(2);
    expect(requester.mock.calls[0]?.[0].servername).toBe("example.com");
    expect(requester.mock.calls[0]?.[0].method).toBe("GET");
  });

  it("returns redirects without following them automatically", async () => {
    const resolver = { resolve: vi.fn(async () => ["1.1.1.1"]) };
    const requester = vi.fn(async (_options: Parameters<RuntimeRequester>[0]) => response);

    await expect(
      requestPinnedHttps(passivePlan("https://example.com/app", 1_000), { resolver, requester }),
    ).resolves.toEqual(response);

    expect(requester).toHaveBeenCalledTimes(1);
  });

  it("includes DNS resolution in the request deadline", async () => {
    vi.useFakeTimers();
    try {
      const resolver = {
        resolve: vi.fn(() => new Promise<readonly string[]>(() => undefined)),
      };
      const requester = vi.fn(async (_options: Parameters<RuntimeRequester>[0]) => response);
      let settled = false;
      let failure: unknown;

      void requestPinnedHttps(
        passivePlan("https://example.com/app", 1_000),
        { resolver, requester },
      ).catch((error: unknown) => {
        failure = error;
      }).finally(() => {
        settled = true;
      });

      await vi.advanceTimersByTimeAsync(1_000);

      expect(settled).toBe(true);
      expect(failure).toMatchObject({ name: "TimeoutError" });
      expect(requester).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("gives HTTPS only the timeout remaining after DNS resolution", async () => {
    const resolver = { resolve: vi.fn(async () => ["1.1.1.1"]) };
    const requester = vi.fn(async (_options: Parameters<RuntimeRequester>[0]) => response);
    const times = [0, 400];

    await requestPinnedHttps(
      passivePlan("https://example.com/app", 1_000),
      { resolver, requester, now: () => times.shift() ?? 400 },
    );

    expect(requester).toHaveBeenCalledTimes(1);
    expect(requester.mock.calls[0]?.[0].timeout).toBe(600);
  });
});
