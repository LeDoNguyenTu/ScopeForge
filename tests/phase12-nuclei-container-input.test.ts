import { describe, expect, it } from "vitest";
import { parseNucleiContainerInput } from "../packages/nuclei-worker-runner/input";
import { NUCLEI_BASELINE_TEMPLATE_ID } from "../packages/provider-nuclei/runtime-profile";

const args = [
  "--workspace-id", "11111111-1111-4111-8111-111111111111",
  "--action-id", "phase12-action:abc123",
  "--authorization-id", "phase12-auth:abc123",
  "--target-node-id", "node-1",
  "--trusted-hostname", "scopeforge.dev",
  "--scheme", "https",
  "--port", "443",
  "--max-runtime-ms", "8000",
  "--template-profile", "baseline-http",
  "--minimum-severity", "info",
] as const;

describe("Phase 12 Nuclei container input", () => {
  it("parses only the initial reviewed runtime profile", () => {
    expect(parseNucleiContainerInput(args)).toEqual({
      target: { hostname: "scopeforge.dev", scheme: "https", port: 443 },
      request: {
        capabilityId: "web.template.validate.v1",
        targetNodeId: "node-1",
        templateProfile: "baseline-http",
        minimumSeverity: "info",
        approvedTemplateIds: [NUCLEI_BASELINE_TEMPLATE_ID],
      },
      context: {
        workspaceId: "11111111-1111-4111-8111-111111111111",
        actionId: "phase12-action:abc123",
        authorizationId: "phase12-auth:abc123",
        targetNodeIds: ["node-1"],
        maxRequests: 1,
        maxRuntimeMs: 8000,
      },
    });
  });

  it("rejects disabled profiles, unknown arguments, and widened runtime", () => {
    const disabled: string[] = [...args];
    disabled[disabled.indexOf("baseline-http")] = "misconfiguration-reviewed";
    expect(() => parseNucleiContainerInput(disabled)).toThrow("NUCLEI_CONTAINER_PROFILE_DISABLED");

    expect(() => parseNucleiContainerInput([...args, "--template", "unsafe.yaml"]))
      .toThrow("NUCLEI_CONTAINER_ARGUMENT_UNKNOWN");

    const widened: string[] = [...args];
    widened[widened.indexOf("8000")] = "20000";
    expect(() => parseNucleiContainerInput(widened))
      .toThrow("NUCLEI_CONTAINER_RUNTIME_INVALID");
  });
});
