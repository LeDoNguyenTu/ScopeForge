import { describe, expect, it } from "vitest";
import { parseNucleiContainerInput } from "../packages/nuclei-worker-runner/input";

const args = [
  "--workspace-id", "11111111-1111-4111-8111-111111111111",
  "--action-id", "phase12-action:abc123",
  "--authorization-id", "phase12-auth:abc123",
  "--target-node-id", "node-1",
  "--trusted-hostname", "scopeforge.dev",
  "--max-runtime-ms", "5000",
] as const;

describe("Phase 12B Nuclei container input", () => {
  it("exposes no caller-controlled template, flags, URL, or severity", () => {
    const parsed = parseNucleiContainerInput(args);
    expect(parsed.request).toEqual({
      capabilityId: "web.template.validate.v1",
      targetNodeId: "node-1",
      templateProfile: "baseline-http",
      minimumSeverity: "info",
      approvedTemplateIds: ["csp-script-src-wildcard"],
    });
    expect(parsed.context.maxRequests).toBe(1);
  });

  it("rejects unknown arguments and widened runtime", () => {
    expect(() => parseNucleiContainerInput([...args, "--template", "CVE-2026-0001"]))
      .toThrow("NUCLEI_CONTAINER_ARGUMENT_UNKNOWN");
    const widened: string[] = [...args];
    widened[widened.indexOf("5000")] = "9000";
    expect(() => parseNucleiContainerInput(widened))
      .toThrow("NUCLEI_CONTAINER_RUNTIME_INVALID");
  });
});
