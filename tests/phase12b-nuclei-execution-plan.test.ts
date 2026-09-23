import { describe, expect, it } from "vitest";
import { buildNucleiExecutionPlan } from "../packages/nuclei-worker-runner/execution-plan";
import {
  NUCLEI_INITIAL_TEMPLATE_ID,
  NUCLEI_INITIAL_TEMPLATE_PATH,
  NUCLEI_RUNTIME_PROVIDER_CONFIG,
  NUCLEI_TEMPLATE_COMMIT,
  NUCLEI_TEMPLATE_RELEASE,
} from "../packages/nuclei-worker-runner/runtime-config";

const request = {
  capabilityId: "web.template.validate.v1" as const,
  targetNodeId: "node-1",
  templateProfile: "baseline-http" as const,
  minimumSeverity: "info" as const,
  approvedTemplateIds: [NUCLEI_INITIAL_TEMPLATE_ID] as const,
};

describe("Phase 12B Nuclei executable profile", () => {
  it("pins one reviewed template snapshot and leaves broader profiles disabled", () => {
    expect(NUCLEI_TEMPLATE_RELEASE).toBe("v10.4.9");
    expect(NUCLEI_TEMPLATE_COMMIT).toBe("893122ffce8ebf8e264f15d2cd3960cb1dd36d6c");
    expect(NUCLEI_RUNTIME_PROVIDER_CONFIG.profiles["baseline-http"]).toEqual([
      "csp-script-src-wildcard",
    ]);
    expect(NUCLEI_RUNTIME_PROVIDER_CONFIG.profiles["misconfiguration-reviewed"]).toEqual([]);
    expect(NUCLEI_RUNTIME_PROVIDER_CONFIG.profiles["known-cve-reviewed"]).toEqual([]);
  });

  it("builds a single-template, single-target, low-concurrency execution profile", () => {
    expect(buildNucleiExecutionPlan(request, "ScopeForge.dev")).toEqual({
      profileId: "projectdiscovery-nuclei-3.11.1-safe-v1",
      executable: "nuclei",
      args: [
        "-u",
        "https://scopeforge.dev:443",
        "-t",
        NUCLEI_INITIAL_TEMPLATE_PATH,
        "-jsonl",
        "-silent",
        "-nc",
        "-duc",
        "-ni",
        "-dc",
        "-rl",
        "1",
        "-bs",
        "1",
        "-c",
        "1",
        "-retries",
        "0",
        "-timeout",
        "5",
      ],
    });
  });

  it("rejects wider profiles, template sets, severities, and hostile hostnames", () => {
    expect(() => buildNucleiExecutionPlan({
      ...request,
      templateProfile: "misconfiguration-reviewed",
    }, "scopeforge.dev")).toThrow("NUCLEI_RUNTIME_PROFILE_DISABLED");

    expect(() => buildNucleiExecutionPlan({
      ...request,
      approvedTemplateIds: ["CVE-2026-0001"],
    }, "scopeforge.dev")).toThrow("NUCLEI_RUNTIME_TEMPLATE_SET_INVALID");

    expect(() => buildNucleiExecutionPlan({
      ...request,
      minimumSeverity: "low",
    }, "scopeforge.dev")).toThrow("NUCLEI_RUNTIME_SEVERITY_PROFILE_UNSUPPORTED");

    for (const host of [
      "scopeforge.dev/path",
      "user@scopeforge.dev",
      "scopeforge.dev:8443",
      "scopeforge.dev --debug",
      "scopeforge.dev\nattacker.invalid",
    ]) {
      expect(() => buildNucleiExecutionPlan(request, host))
        .toThrow("NUCLEI_TRUSTED_HOSTNAME_INVALID");
    }
  });
});
