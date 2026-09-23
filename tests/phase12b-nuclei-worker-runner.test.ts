import { describe, expect, it, vi } from "vitest";
import type { ProviderExecutionContext } from "../packages/capability-registry/types";
import { executeNucleiRunner, type NucleiCommandDriver } from "../packages/nuclei-worker-runner/runner";
import { NUCLEI_INITIAL_TEMPLATE_ID } from "../packages/nuclei-worker-runner/runtime-config";

const context: ProviderExecutionContext = {
  workspaceId: "workspace-1",
  actionId: "action-1",
  authorizationId: "auth-1",
  targetNodeIds: ["node-1"],
  maxRequests: 1,
  maxRuntimeMs: 5_000,
};

const request = {
  capabilityId: "web.template.validate.v1" as const,
  targetNodeId: "node-1",
  templateProfile: "baseline-http" as const,
  minimumSeverity: "info" as const,
  approvedTemplateIds: [NUCLEI_INITIAL_TEMPLATE_ID] as const,
};

function driver(stdout: string, exitCode = 0, stderr = ""): NucleiCommandDriver {
  return { exec: vi.fn(async () => ({ exitCode, stdout, stderr })) };
}

describe("Phase 12B Nuclei worker runner", () => {
  it("invokes only the fixed binary with the safe immutable profile", async () => {
    const mock = driver(JSON.stringify({
      "template-id": "csp-script-src-wildcard",
      info: { severity: "info" },
      "matcher-name": "content-security-policy",
      timestamp: "2026-09-23T00:00:00Z",
      url: "https://scopeforge.dev/",
      host: "scopeforge.dev",
    }));

    const result = await executeNucleiRunner({
      request,
      context,
      trustedHostname: "scopeforge.dev",
    }, new AbortController().signal, { driver: mock });

    expect(mock.exec).toHaveBeenCalledTimes(1);
    const call = vi.mocked(mock.exec).mock.calls[0];
    expect(call?.[0]).toBe("/opt/scopeforge/bin/nuclei");
    expect(call?.[1]).toContain("-ni");
    expect(call?.[1]).toContain("-duc");
    expect(call?.[1]).toContain("1");
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]).toMatchObject({
      targetNodeId: "node-1",
      templateId: "csp-script-src-wildcard",
      severity: "info",
      matcherName: "content-security-policy",
    });
    expect(result.matches[0]?.evidenceRef).toMatch(/^phase12-nuclei-json:[a-f0-9]{64}$/);
    expect(JSON.stringify(result)).not.toContain("https://scopeforge.dev/");
  });

  it("returns no matches for valid empty output", async () => {
    await expect(executeNucleiRunner({
      request,
      context,
      trustedHostname: "scopeforge.dev",
    }, new AbortController().signal, { driver: driver("") })).resolves.toMatchObject({
      capabilityId: "web.template.validate.v1",
      actionId: "action-1",
      targetNodeId: "node-1",
      matches: [],
    });
  });

  it("rejects unapproved templates and forbidden raw execution surfaces", async () => {
    await expect(executeNucleiRunner({
      request,
      context,
      trustedHostname: "scopeforge.dev",
    }, new AbortController().signal, {
      driver: driver(JSON.stringify({
        "template-id": "CVE-2026-0001",
        info: { severity: "critical" },
        timestamp: "2026-09-23T00:00:00Z",
      })),
    })).rejects.toThrow("NUCLEI_OUTPUT_TEMPLATE_NOT_APPROVED");

    await expect(executeNucleiRunner({
      request,
      context,
      trustedHostname: "scopeforge.dev",
    }, new AbortController().signal, {
      driver: driver(JSON.stringify({
        "template-id": "csp-script-src-wildcard",
        info: { severity: "info" },
        timestamp: "2026-09-23T00:00:00Z",
        request: "GET / HTTP/1.1",
      })),
    })).rejects.toThrow("NUCLEI_OUTPUT_FORBIDDEN_SURFACE_PRESENT");
  });

  it("rejects oversized cardinality and malformed JSON", async () => {
    const line = JSON.stringify({
      "template-id": "csp-script-src-wildcard",
      info: { severity: "info" },
      timestamp: "2026-09-23T00:00:00Z",
    });
    await expect(executeNucleiRunner({
      request,
      context,
      trustedHostname: "scopeforge.dev",
    }, new AbortController().signal, {
      driver: driver(Array.from({ length: 17 }, () => line).join("\n")),
    })).rejects.toThrow("NUCLEI_OUTPUT_MATCH_LIMIT_EXCEEDED");

    await expect(executeNucleiRunner({
      request,
      context,
      trustedHostname: "scopeforge.dev",
    }, new AbortController().signal, { driver: driver("not-json") }))
      .rejects.toThrow("NUCLEI_OUTPUT_JSON_INVALID");
  });

  it("rejects out-of-scope target binding before invoking the process", async () => {
    const mock = driver("");
    await expect(executeNucleiRunner({
      request: { ...request, targetNodeId: "node-2" },
      context,
      trustedHostname: "scopeforge.dev",
    }, new AbortController().signal, { driver: mock }))
      .rejects.toThrow("NUCLEI_TARGET_BINDING_INVALID");
    expect(mock.exec).not.toHaveBeenCalled();
  });
});
