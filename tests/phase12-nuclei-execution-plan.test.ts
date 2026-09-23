import { describe, expect, it } from "vitest";
import {
  buildNucleiExecutionPlan,
  NUCLEI_EXECUTABLE_PROFILE_ID,
  NUCLEI_LINUX_AMD64_ZIP_SHA256,
  NUCLEI_LINUX_ARM64_ZIP_SHA256,
} from "../packages/provider-nuclei/execution-plan";
import { NUCLEI_BASELINE_TEMPLATE_ID } from "../packages/provider-nuclei/runtime-profile";

const request = {
  capabilityId: "web.template.validate.v1" as const,
  targetNodeId: "node-1",
  templateProfile: "baseline-http" as const,
  minimumSeverity: "info" as const,
  approvedTemplateIds: [NUCLEI_BASELINE_TEMPLATE_ID] as const,
};

describe("Phase 12 Nuclei executable profile", () => {
  it("pins the reviewed upstream Linux release artifacts", () => {
    expect(NUCLEI_EXECUTABLE_PROFILE_ID).toBe("projectdiscovery-nuclei-3.11.1-baseline-http-v1");
    expect(NUCLEI_LINUX_AMD64_ZIP_SHA256).toMatch(/^[a-f0-9]{64}$/);
    expect(NUCLEI_LINUX_ARM64_ZIP_SHA256).toMatch(/^[a-f0-9]{64}$/);
    expect(NUCLEI_LINUX_AMD64_ZIP_SHA256).not.toBe(NUCLEI_LINUX_ARM64_ZIP_SHA256);
  });

  it("builds one closed, no-redirect, no-OAST execution profile", () => {
    const plan = buildNucleiExecutionPlan(request, {
      hostname: "ScopeForge.dev",
      scheme: "https",
      port: 443,
    });

    expect(plan.executable).toBe("nuclei");
    expect(plan.args).toContain("https://scopeforge.dev:443");
    expect(plan.args).toContain("-dr");
    expect(plan.args).toContain("-ni");
    expect(plan.args).toContain("-nh");
    expect(plan.args).toContain("-duc");
    expect(plan.args).toContain("-omit-raw");
    expect(plan.args).toContain("-omit-template");
    expect(plan.args.filter((value) => value === "-proxy")).toHaveLength(1);
    expect(plan.args).toEqual(expect.arrayContaining([
      "-proxy",
      "socks5://127.0.0.1:17777",
    ]));
    expect(plan.args).toEqual(expect.arrayContaining(["-rl", "1", "-bs", "1", "-c", "1", "-pc", "1"]));
    expect(plan.args).not.toContain("-fr");
    expect(plan.args).not.toContain("-fhr");
  });

  it("rejects disabled profiles and any widened template set", () => {
    expect(() => buildNucleiExecutionPlan({
      ...request,
      templateProfile: "misconfiguration-reviewed",
    }, { hostname: "scopeforge.dev", scheme: "https", port: 443 }))
      .toThrow("NUCLEI_RUNTIME_PROFILE_DISABLED");

    expect(() => buildNucleiExecutionPlan({
      ...request,
      approvedTemplateIds: [NUCLEI_BASELINE_TEMPLATE_ID, "other-template"],
    }, { hostname: "scopeforge.dev", scheme: "https", port: 443 }))
      .toThrow("NUCLEI_RUNTIME_TEMPLATE_SET_INVALID");
  });

  it("rejects untrusted target syntax", () => {
    for (const hostname of [
      "scopeforge.dev/path",
      "scopeforge.dev?x=1",
      "user@scopeforge.dev",
      "scopeforge.dev:8443",
      "scopeforge.dev --flag",
      "scopeforge.dev\nattacker.invalid",
    ]) {
      expect(() => buildNucleiExecutionPlan(
        request,
        { hostname, scheme: "https", port: 443 },
      )).toThrow("NUCLEI_TRUSTED_HOSTNAME_INVALID");
    }
  });
});
