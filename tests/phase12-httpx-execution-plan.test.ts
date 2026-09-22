import { describe, expect, it } from "vitest";
import { buildHttpxExecutionPlan, HTTPX_EXECUTABLE_PROFILE_ID } from "../packages/provider-httpx/execution-plan";

describe("Phase 12 httpx executable profile", () => {
  it("builds one deterministic closed argument profile from trusted hostname plus reviewed request", () => {
    expect(buildHttpxExecutionPlan({
      capabilityId: "web.http.probe.v1",
      targetNodeId: "node-1",
      scheme: "https",
      port: 443,
      maxRedirects: 1,
      probes: ["content_type", "server", "status", "tech", "title", "tls"],
    }, "ScopeForge.dev")).toEqual({
      profileId: HTTPX_EXECUTABLE_PROFILE_ID,
      executable: "httpx",
      args: [
        "-u",
        "https://scopeforge.dev:443",
        "-json",
        "-silent",
        "-no-color",
        "-no-fallback",
        "-timeout",
        "5",
        "-maxr",
        "1",
        "-fr",
        "-ct",
        "-server",
        "-sc",
        "-td",
        "-title",
        "-tls-grab",
      ],
    });
  });

  it("does not allow caller-provided paths, query strings, credentials, or native flags", () => {
    for (const hostname of [
      "scopeforge.dev/path",
      "scopeforge.dev?x=1",
      "user@scopeforge.dev",
      "scopeforge.dev:8443",
      "scopeforge.dev --silent",
      "scopeforge.dev\nattacker.invalid",
    ]) {
      expect(() => buildHttpxExecutionPlan({
        capabilityId: "web.http.probe.v1",
        targetNodeId: "node-1",
        scheme: "https",
        port: 443,
        maxRedirects: 0,
        probes: ["status"],
      }, hostname)).toThrow("HTTPX_TRUSTED_HOSTNAME_INVALID");
    }
  });

  it("keeps redirects disabled unless the authorized profile explicitly permits them", () => {
    const plan = buildHttpxExecutionPlan({
      capabilityId: "web.http.probe.v1",
      targetNodeId: "node-1",
      scheme: "https",
      port: 443,
      maxRedirects: 0,
      probes: ["status"],
    }, "scopeforge.dev");
    expect(plan.args).not.toContain("-fr");
    expect(plan.args).toContain("0");
  });
});
