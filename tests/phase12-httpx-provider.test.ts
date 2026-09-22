import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type {
  ProviderExecutionContext,
  ProviderNormalizationContext,
  ProviderPolicyContext,
} from "../packages/capability-registry/types";
import {
  createHttpxProvider,
  type HttpxRawResult,
  type HttpxRunner,
} from "../packages/provider-httpx";

const policy: ProviderPolicyContext = {
  workspaceId: "workspace-1",
  authorizationSnapshotRef: "snapshot-1",
  executionMode: "safe_active",
};

const execution: ProviderExecutionContext = {
  workspaceId: "workspace-1",
  actionId: "action-1",
  authorizationId: "auth-1",
  targetNodeIds: ["node-1"],
  maxRequests: 1,
  maxRuntimeMs: 5_000,
};

const normalization: ProviderNormalizationContext = {
  runId: "run-1",
  actionId: "action-1",
  authorizationSnapshotRef: "snapshot-1",
};

function runner(result: HttpxRawResult): HttpxRunner {
  return { run: async () => result };
}

describe("Phase 12 external httpx provider contract", () => {
  it("keeps process and network authority out of the adapter", async () => {
    const source = await readFile(
      path.resolve(process.cwd(), "packages/provider-httpx/index.ts"),
      "utf8",
    );
    for (const forbidden of [
      /node:child_process/,
      /node:net/,
      /node:dns/,
      /node:http/,
      /node:https/,
      /\bfetch\s*\(/,
      /\bspawn\s*\(/,
      /\bexec(File)?\s*\(/,
      /shell\s*:\s*true/,
    ]) {
      expect(source).not.toMatch(forbidden);
    }
  });

  it("rejects caller URLs, provider flags, duplicate probes, and excessive redirects", () => {
    const provider = createHttpxProvider(runner({
      capabilityId: "web.http.probe.v1",
      actionId: "action-1",
      targetNodeId: "node-1",
      scheme: "https",
      port: 443,
      maxRedirects: 0,
    }));

    expect(provider.validateRequest({
      capabilityId: "web.http.probe.v1",
      targetNodeId: "node-1",
      scheme: "https",
      port: 443,
      maxRedirects: 0,
      probes: ["status"],
      url: "https://attacker.invalid/",
    } as never, policy)).toEqual({ ok: false, code: "HTTPX_REQUEST_INVALID" });

    expect(provider.validateRequest({
      capabilityId: "web.http.probe.v1",
      targetNodeId: "node-1",
      scheme: "https",
      port: 443,
      maxRedirects: 0,
      probes: ["status"],
      providerNativeArgs: ["-fr"],
    } as never, policy)).toEqual({ ok: false, code: "HTTPX_REQUEST_INVALID" });

    expect(provider.validateRequest({
      capabilityId: "web.http.probe.v1",
      targetNodeId: "node-1",
      scheme: "https",
      port: 443,
      maxRedirects: 0,
      probes: ["status", "status"],
    }, policy)).toEqual({ ok: false, code: "HTTPX_REQUEST_INVALID" });

    expect(provider.validateRequest({
      capabilityId: "web.http.probe.v1",
      targetNodeId: "node-1",
      scheme: "https",
      port: 443,
      maxRedirects: 4,
      probes: ["status"],
    }, policy)).toEqual({ ok: false, code: "HTTPX_REQUEST_INVALID" });
  });

  it("enforces target binding before invoking the runner", async () => {
    const provider = createHttpxProvider(runner({
      capabilityId: "web.http.probe.v1",
      actionId: "action-1",
      targetNodeId: "node-2",
      scheme: "https",
      port: 443,
      maxRedirects: 0,
    }));

    await expect(provider.execute({
      capabilityId: "web.http.probe.v1",
      targetNodeId: "node-2",
      scheme: "https",
      port: 443,
      maxRedirects: 0,
      probes: ["status"],
    }, execution, new AbortController().signal)).rejects.toThrow("HTTPX_TARGET_BINDING_INVALID");
  });

  it("normalizes one privacy-reduced deterministic observation", async () => {
    const provider = createHttpxProvider(runner({
      capabilityId: "web.http.probe.v1",
      actionId: "action-1",
      targetNodeId: "node-1",
      scheme: "https",
      port: 443,
      maxRedirects: 1,
      record: {
        targetNodeId: "node-1",
        status: 200,
        redirectCount: 1,
        contentType: "text/html",
        title: "ScopeForge",
        server: "edge",
        tlsProtocol: "TLSv1.3",
        technologies: ["Next.js", "React"],
        evidenceRef: "phase12-evidence:httpx:1",
        observedAt: "2026-09-23T00:00:00Z",
      },
    }));

    const raw = await provider.execute({
      capabilityId: "web.http.probe.v1",
      targetNodeId: "node-1",
      scheme: "https",
      port: 443,
      maxRedirects: 1,
      probes: ["content_type", "server", "status", "tech", "title", "tls"],
    }, execution, new AbortController().signal);

    const first = await provider.normalize(raw, normalization);
    const second = await provider.normalize(raw, normalization);

    expect(second).toEqual(first);
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({
      providerId: "projectdiscovery.httpx",
      providerVersion: "1.12.0",
      capabilityId: "web.http.probe.v1",
      evidenceRefs: ["phase12-evidence:httpx:1"],
      executionMode: "safe_active",
      facts: {
        scheme: "https",
        port: 443,
        status: 200,
        redirectCount: 1,
        contentType: "text/html",
        title: "ScopeForge",
        server: "edge",
        tlsProtocol: "TLSv1.3",
        technologies: "Next.js,React",
      },
    });
    expect(first[0]?.observationId).toMatch(/^phase12-obs-httpx:[0-9a-f]{64}$/);
    expect(JSON.stringify(first)).not.toMatch(/https?:\/\//);
  });

  it("returns no observation for a valid no-signal result", async () => {
    const provider = createHttpxProvider(runner({
      capabilityId: "web.http.probe.v1",
      actionId: "action-1",
      targetNodeId: "node-1",
      scheme: "https",
      port: 443,
      maxRedirects: 0,
    }));

    expect(await provider.normalize({
      capabilityId: "web.http.probe.v1",
      actionId: "action-1",
      targetNodeId: "node-1",
      scheme: "https",
      port: 443,
      maxRedirects: 0,
    }, normalization)).toEqual([]);
  });

  it("rejects malformed or over-broad runner output", async () => {
    const provider = createHttpxProvider(runner({
      capabilityId: "web.http.probe.v1",
      actionId: "action-1",
      targetNodeId: "node-1",
      scheme: "https",
      port: 443,
      maxRedirects: 0,
    }));

    await expect(provider.normalize({
      capabilityId: "web.http.probe.v1",
      actionId: "action-1",
      targetNodeId: "node-1",
      scheme: "https",
      port: 443,
      maxRedirects: 0,
      record: {
        targetNodeId: "node-1",
        status: 200,
        redirectCount: 1,
        evidenceRef: "e-1",
        observedAt: "2026-09-23T00:00:00Z",
      },
    }, normalization)).rejects.toThrow("HTTPX_RESULT_REDIRECT_COUNT_INVALID");

    await expect(provider.normalize({
      capabilityId: "web.http.probe.v1",
      actionId: "action-1",
      targetNodeId: "node-1",
      scheme: "https",
      port: 443,
      maxRedirects: 0,
      record: {
        targetNodeId: "node-1",
        status: 200,
        redirectCount: 0,
        technologies: Array.from({ length: 33 }, (_, index) => `tech-${index}`),
        evidenceRef: "e-2",
        observedAt: "2026-09-23T00:00:00Z",
      },
    }, normalization)).rejects.toThrow("HTTPX_RESULT_TECHNOLOGY_LIMIT_EXCEEDED");
  });
});
