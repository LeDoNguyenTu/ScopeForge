import { describe, expect, it } from "vitest";
import {
  buildHttpxExecutionPlan,
  HTTPX_EXECUTABLE_PROFILE_ID,
  HTTPX_LINUX_AMD64_ZIP_SHA256,
  HTTPX_LINUX_ARM64_ZIP_SHA256,
} from "../packages/provider-httpx/execution-plan";

describe("Phase 12 httpx executable profile", () => {
  it("pins the reviewed upstream Linux release artifacts", () => {
    expect(HTTPX_LINUX_AMD64_ZIP_SHA256).toMatch(/^[a-f0-9]{64}$/);
    expect(HTTPX_LINUX_ARM64_ZIP_SHA256).toMatch(/^[a-f0-9]{64}$/);
    expect(HTTPX_LINUX_AMD64_ZIP_SHA256).not.toBe(HTTPX_LINUX_ARM64_ZIP_SHA256);
  });

  it("builds one deterministic closed argument profile from trusted hostname plus reviewed request", () => {
    expect(buildHttpxExecutionPlan({
      capabilityId: "web.http.probe.v1",
      targetNodeId: "node-1",
      scheme: "https",
      port: 443,
      maxRedirects: 0,
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
        "-no-stdin",
        "-duc",
        "-nfs",
        "-retries",
        "0",
        "-t",
        "1",
        "-rl",
        "1",
        "-timeout",
        "5",
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

  it("keeps redirects disabled in the first runtime profile", () => {
    expect(() => buildHttpxExecutionPlan({
      capabilityId: "web.http.probe.v1",
      targetNodeId: "node-1",
      scheme: "https",
      port: 443,
      maxRedirects: 1,
      probes: ["status"],
    }, "scopeforge.dev")).toThrow("HTTPX_REDIRECT_PROFILE_NOT_RUNTIME_APPROVED");
  });
});
