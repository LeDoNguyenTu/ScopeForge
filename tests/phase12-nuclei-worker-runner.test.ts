import { describe, expect, it, vi } from "vitest";
import type { ProviderExecutionContext } from "../packages/capability-registry/types";
import { NUCLEI_BASELINE_TEMPLATE_ID } from "../packages/provider-nuclei/runtime-profile";
import {
  executeNucleiRunner,
  type NucleiCommandDriver,
} from "../packages/nuclei-worker-runner/runner";

const context: ProviderExecutionContext = {
  workspaceId: "workspace-1",
  actionId: "action-1",
  authorizationId: "auth-1",
  targetNodeIds: ["node-1"],
  maxRequests: 1,
  maxRuntimeMs: 8_000,
};

const request = {
  capabilityId: "web.template.validate.v1" as const,
  targetNodeId: "node-1",
  templateProfile: "baseline-http" as const,
  minimumSeverity: "info" as const,
  approvedTemplateIds: [NUCLEI_BASELINE_TEMPLATE_ID] as const,
};

function driver(stdout: string, exitCode = 0, stderr = ""): NucleiCommandDriver {
  return { exec: vi.fn(async () => ({ exitCode, stdout, stderr })) };
}

describe("Phase 12 Nuclei worker runner", () => {
  it("invokes only the fixed binary and returns privacy-reduced match evidence", async () => {
    const output = JSON.stringify({
      "template-id": NUCLEI_BASELINE_TEMPLATE_ID,
      "matcher-name": "content-security-policy",
      "matched-at": "https://scopeforge.dev/",
      timestamp: "2026-09-23T12:00:00Z",
      info: { severity: "info" },
    });
    const mock = driver(output);

    const result = await executeNucleiRunner({
      request,
      context,
      target: { hostname: "scopeforge.dev", scheme: "https", port: 443 },
    }, new AbortController().signal, { driver: mock });

    const call = vi.mocked(mock.exec).mock.calls[0];
    expect(call?.[0]).toBe("/opt/scopeforge/bin/nuclei");
    expect(call?.[1]).toContain("-omit-raw");
    expect(call?.[1]).toContain("-omit-template");
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]).toMatchObject({
      targetNodeId: "node-1",
      templateId: NUCLEI_BASELINE_TEMPLATE_ID,
      severity: "info",
      matcherName: "content-security-policy",
      observedAt: "2026-09-23T12:00:00.000Z",
    });
    expect(result.matches[0]?.evidenceRef).toMatch(/^phase12-nuclei-json:[a-f0-9]{64}$/);
    expect(JSON.stringify(result)).not.toContain("matched-at");
  });

  it("returns a bounded no-signal result for empty output", async () => {
    await expect(executeNucleiRunner({
      request,
      context,
      target: { hostname: "scopeforge.dev", scheme: "https", port: 443 },
    }, new AbortController().signal, { driver: driver("") })).resolves.toMatchObject({
      capabilityId: "web.template.validate.v1",
      actionId: "action-1",
      targetNodeId: "node-1",
      matches: [],
    });
  });

  it("rejects sensitive raw output fields before normalization", async () => {
    const raw = JSON.stringify({
      "template-id": NUCLEI_BASELINE_TEMPLATE_ID,
      "matched-at": "https://scopeforge.dev/",
      timestamp: "2026-09-23T12:00:00Z",
      info: { severity: "info" },
      request: "GET / HTTP/1.1",
    });
    await expect(executeNucleiRunner({
      request,
      context,
      target: { hostname: "scopeforge.dev", scheme: "https", port: 443 },
    }, new AbortController().signal, { driver: driver(raw) }))
      .rejects.toThrow("NUCLEI_OUTPUT_SENSITIVE_FIELD_PRESENT");
  });

  it("rejects output for another origin or an unapproved template", async () => {
    const otherOrigin = JSON.stringify({
      "template-id": NUCLEI_BASELINE_TEMPLATE_ID,
      "matched-at": "https://attacker.invalid/",
      timestamp: "2026-09-23T12:00:00Z",
      info: { severity: "info" },
    });
    await expect(executeNucleiRunner({
      request,
      context,
      target: { hostname: "scopeforge.dev", scheme: "https", port: 443 },
    }, new AbortController().signal, { driver: driver(otherOrigin) }))
      .rejects.toThrow("NUCLEI_OUTPUT_TARGET_OUT_OF_SCOPE");

    const unapproved = JSON.stringify({
      "template-id": "unapproved-template",
      "matched-at": "https://scopeforge.dev/",
      timestamp: "2026-09-23T12:00:00Z",
      info: { severity: "info" },
    });
    await expect(executeNucleiRunner({
      request,
      context,
      target: { hostname: "scopeforge.dev", scheme: "https", port: 443 },
    }, new AbortController().signal, { driver: driver(unapproved) }))
      .rejects.toThrow("NUCLEI_OUTPUT_TEMPLATE_NOT_APPROVED");
  });

  it("rejects out-of-scope target binding before process execution", async () => {
    const mock = driver("");
    await expect(executeNucleiRunner({
      request: { ...request, targetNodeId: "node-2" },
      context,
      target: { hostname: "scopeforge.dev", scheme: "https", port: 443 },
    }, new AbortController().signal, { driver: mock }))
      .rejects.toThrow("NUCLEI_TARGET_BINDING_INVALID");
    expect(mock.exec).not.toHaveBeenCalled();
  });
});
