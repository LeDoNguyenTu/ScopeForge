import { describe, expect, it, vi } from "vitest";
import type { Observation } from "../security-planning";
import { createCapabilityRegistry } from "./registry";
import type { CapabilityProvider, ProviderHealth } from "./types";

function provider(
  providerId: string,
  options: {
    capabilityIds?: readonly string[];
    supportedModes?: readonly ("passive" | "safe_active" | "intrusive" | "validation")[];
  } = {},
): CapabilityProvider<Record<string, never>, Record<string, never>, Observation> {
  return {
    providerId,
    version: "1.0.0",
    capabilityIds: options.capabilityIds ?? ["web.http.probe.v1"],
    supportedModes: options.supportedModes ?? ["safe_active"],
    validateRequest: () => ({ ok: true }),
    execute: vi.fn(async () => ({})),
    normalize: vi.fn(async () => []),
    cleanup: vi.fn(async () => ({ ok: true })),
  };
}

function registration(
  p: CapabilityProvider,
  options: { enabled?: boolean; health?: ProviderHealth; priority?: number } = {},
) {
  return {
    provider: p,
    enabled: options.enabled ?? true,
    health: options.health ?? "healthy",
    priority: options.priority ?? 0,
  };
}

describe("Phase 11 capability registry", () => {
  it("rejects duplicate provider registration", () => {
    const p = provider("native");
    expect(() => createCapabilityRegistry([registration(p), registration(p)]))
      .toThrow("PROVIDER_DUPLICATE:native");
  });

  it("rejects unknown capabilities and unsupported modes deterministically", () => {
    const registry = createCapabilityRegistry([registration(provider("native"))]);
    expect(registry.select("network.port.discover.v1", "safe_active")).toEqual({
      ok: false,
      code: "UNKNOWN_CAPABILITY",
    });
    expect(registry.select("web.http.probe.v1", "intrusive")).toEqual({
      ok: false,
      code: "MODE_UNSUPPORTED",
    });
  });

  it("does not select disabled providers", () => {
    const registry = createCapabilityRegistry([
      registration(provider("native"), { enabled: false }),
    ]);
    expect(registry.select("web.http.probe.v1", "safe_active")).toEqual({
      ok: false,
      code: "PROVIDER_DISABLED",
    });
  });

  it("selects deterministically by health, priority, then provider id", () => {
    const registry = createCapabilityRegistry([
      registration(provider("z-provider"), { priority: 10, health: "degraded" }),
      registration(provider("b-provider"), { priority: 5, health: "healthy" }),
      registration(provider("a-provider"), { priority: 5, health: "healthy" }),
    ]);

    const selected = registry.select("web.http.probe.v1", "safe_active");
    expect(selected.ok).toBe(true);
    if (!selected.ok) return;
    expect(selected.provider.providerId).toBe("a-provider");
  });

  it("falls back when a preferred provider is unavailable", () => {
    const registry = createCapabilityRegistry([
      registration(provider("primary"), { priority: 100, health: "unavailable" }),
      registration(provider("fallback"), { priority: 1, health: "healthy" }),
    ]);

    const selected = registry.select("web.http.probe.v1", "safe_active");
    expect(selected.ok).toBe(true);
    if (!selected.ok) return;
    expect(selected.provider.providerId).toBe("fallback");
  });

  it("exposes only statically registered providers", () => {
    const registry = createCapabilityRegistry([
      registration(provider("native", { capabilityIds: ["web.http.probe.v1", "runtime.observe.v1"] })),
    ]);
    expect(registry.providers().map((item) => item.providerId)).toEqual(["native"]);
  });
});
