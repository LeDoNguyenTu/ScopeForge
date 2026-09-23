import { describe, expect, it } from "vitest";
import { parseHttpxContainerInput } from "../packages/httpx-worker-runner/input";

const args = [
  "--workspace-id", "11111111-1111-4111-8111-111111111111",
  "--action-id", "phase12-action:abc123",
  "--authorization-id", "phase12-auth:abc123",
  "--target-node-id", "node-1",
  "--trusted-hostname", "scopeforge.dev",
  "--scheme", "https",
  "--port", "443",
  "--max-runtime-ms", "5000",
  "--probes", "status,title",
] as const;

describe("Phase 12 httpx container input", () => {
  it("parses only the closed trusted input surface", () => {
    expect(parseHttpxContainerInput(args)).toEqual({
      trustedHostname: "scopeforge.dev",
      request: {
        capabilityId: "web.http.probe.v1",
        targetNodeId: "node-1",
        scheme: "https",
        port: 443,
        maxRedirects: 0,
        probes: ["status", "title"],
      },
      context: {
        workspaceId: "11111111-1111-4111-8111-111111111111",
        actionId: "phase12-action:abc123",
        authorizationId: "phase12-auth:abc123",
        targetNodeIds: ["node-1"],
        maxRequests: 1,
        maxRuntimeMs: 5000,
      },
    });
  });

  it("rejects unknown arguments, duplicate keys, and widened budgets", () => {
    expect(() => parseHttpxContainerInput([...args, "--url", "https://attacker.invalid"]))
      .toThrow("HTTPX_CONTAINER_ARGUMENT_UNKNOWN");

    expect(() => parseHttpxContainerInput([...args, "--port", "8443"]))
      .toThrow("HTTPX_CONTAINER_ARGUMENTS_INVALID");

    const widened = [...args];
    widened[widened.indexOf("5000")] = "9000";
    expect(() => parseHttpxContainerInput(widened))
      .toThrow("HTTPX_CONTAINER_RUNTIME_INVALID");
  });
});
