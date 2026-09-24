import { describe, expect, it } from "vitest";
import {
  PROVIDER_RUNTIME_READINESS,
  runtimeReadinessSummary,
} from "../lib/provider-runtime/readiness";

describe("provider runtime presentation state", () => {
  it("keeps external providers visibly default-off until acceptance gates pass", () => {
    const external = PROVIDER_RUNTIME_READINESS.filter((provider) =>
      provider.providerId === "projectdiscovery.httpx" || provider.providerId === "nuclei",
    );
    expect(external).toHaveLength(2);
    for (const provider of external) {
      expect(provider.enabled).toBe(false);
      expect(provider.availability).toBe("validation");
      expect(provider.gates.find((gate) => gate.id === "linux")).toMatchObject({ state: "pending" });
      expect(provider.gates.find((gate) => gate.id === "control-plane")).toMatchObject({ state: "locked" });
      expect(provider.gates.find((gate) => gate.id === "canary")).toMatchObject({ state: "locked" });
    }
  });

  it("marks only the accepted first-party HTTP runtime operational", () => {
    const operational = PROVIDER_RUNTIME_READINESS.filter((provider) => provider.availability === "operational");
    expect(operational).toHaveLength(1);
    expect(operational[0]?.providerId).toBe("scopeforge.http-discovery");
    expect(operational[0]?.enabled).toBe(true);
    expect(runtimeReadinessSummary()).toEqual({
      operational: 1,
      preparedExternal: 2,
      enabledExternal: 0,
      pendingContainment: 2,
    });
  });

  it("does not expose an arbitrary execution surface in presentation metadata", () => {
    const serialized = JSON.stringify(PROVIDER_RUNTIME_READINESS);
    expect(serialized).not.toMatch(/shell|arbitrary url|host network|bridge network/i);
    expect(serialized).not.toContain("http://");
    expect(serialized).not.toContain("https://");
  });
});
