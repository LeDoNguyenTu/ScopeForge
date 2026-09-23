import { describe, expect, it, vi } from "vitest";
import type { ProviderExecutionContext } from "../packages/capability-registry/types";
import {
  executeHttpxRunner,
  type HttpxCommandDriver,
} from "../packages/httpx-worker-runner/runner";

const context: ProviderExecutionContext = {
  workspaceId: "workspace-1",
  actionId: "action-1",
  authorizationId: "auth-1",
  targetNodeIds: ["node-1"],
  maxRequests: 1,
  maxRuntimeMs: 5_000,
};

const request = {
  capabilityId: "web.http.probe.v1" as const,
  targetNodeId: "node-1",
  scheme: "https" as const,
  port: 443,
  maxRedirects: 0,
  probes: ["content_type", "server", "status", "tech", "title", "tls"] as const,
};

function driver(stdout: string, exitCode = 0, stderr = ""): HttpxCommandDriver {
  return { exec: vi.fn(async () => ({ exitCode, stdout, stderr })) };
}

describe("Phase 12 httpx worker runner", () => {
  it("invokes only the fixed binary with the closed profile", async () => {
    const mock = driver(JSON.stringify({
      status_code: 200,
      content_type: "text/html",
      title: "ScopeForge",
      webserver: "edge",
      tech: ["Next.js", "React"],
      tls: { version: "TLSv1.3" },
    }));
    const result = await executeHttpxRunner({
      request,
      context,
      trustedHostname: "scopeforge.dev",
    }, new AbortController().signal, { driver: mock });

    expect(mock.exec).toHaveBeenCalledTimes(1);
    const call = vi.mocked(mock.exec).mock.calls[0];
    expect(call?.[0]).toBe("/opt/scopeforge/bin/httpx");
    expect(call?.[1]).toContain("https://scopeforge.dev:443");
    expect(call?.[1]).toContain("-duc");
    expect(call?.[1]).toContain("-no-stdin");
    expect(call?.[1]).not.toContain("-fr");
    expect(result.record).toMatchObject({
      targetNodeId: "node-1",
      status: 200,
      redirectCount: 0,
      contentType: "text/html",
      title: "ScopeForge",
      server: "edge",
      tlsProtocol: "TLSv1.3",
      technologies: ["Next.js", "React"],
    });
    expect(result.record?.evidenceRef).toMatch(/^phase12-httpx-json:[a-f0-9]{64}$/);
  });

  it("returns a bounded no-signal result when stdout has no JSON record", async () => {
    await expect(executeHttpxRunner({
      request,
      context,
      trustedHostname: "scopeforge.dev",
    }, new AbortController().signal, { driver: driver("") })).resolves.toEqual({
      capabilityId: "web.http.probe.v1",
      actionId: "action-1",
      targetNodeId: "node-1",
      scheme: "https",
      port: 443,
      maxRedirects: 0,
    });
  });

  it("rejects multiple records, nonzero exits, redirects, and malformed output", async () => {
    await expect(executeHttpxRunner({
      request,
      context,
      trustedHostname: "scopeforge.dev",
    }, new AbortController().signal, {
      driver: driver('{"status_code":200}\n{"status_code":201}\n'),
    })).rejects.toThrow("HTTPX_OUTPUT_CARDINALITY_INVALID");

    await expect(executeHttpxRunner({
      request,
      context,
      trustedHostname: "scopeforge.dev",
    }, new AbortController().signal, { driver: driver("", 2) }))
      .rejects.toThrow("HTTPX_PROCESS_EXIT_NONZERO");

    await expect(executeHttpxRunner({
      request,
      context,
      trustedHostname: "scopeforge.dev",
    }, new AbortController().signal, {
      driver: driver(JSON.stringify({ status_code: 200, chain_status_codes: [301, 200] })),
    })).rejects.toThrow("HTTPX_OUTPUT_REDIRECT_NOT_ALLOWED");

    await expect(executeHttpxRunner({
      request,
      context,
      trustedHostname: "scopeforge.dev",
    }, new AbortController().signal, { driver: driver("not-json") }))
      .rejects.toThrow("HTTPX_OUTPUT_JSON_INVALID");
  });

  it("rejects out-of-scope target binding before process execution", async () => {
    const mock = driver("");
    await expect(executeHttpxRunner({
      request: { ...request, targetNodeId: "node-2" },
      context,
      trustedHostname: "scopeforge.dev",
    }, new AbortController().signal, { driver: mock }))
      .rejects.toThrow("HTTPX_TARGET_BINDING_INVALID");
    expect(mock.exec).not.toHaveBeenCalled();
  });
});
