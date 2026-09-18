import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { ProviderExecutionContext, ProviderNormalizationContext, ProviderPolicyContext } from "../packages/capability-registry/types";
import { createNmapProvider, type NmapRawResult, type NmapRunner } from "../packages/provider-nmap";
import { createNucleiProvider, type NucleiRawResult, type NucleiRunner } from "../packages/provider-nuclei";
import { createHttpDiscoveryProvider, type HttpDiscoveryRawResult, type HttpDiscoveryRunner } from "../packages/provider-http-discovery";

const safeActivePolicy: ProviderPolicyContext = { workspaceId: "workspace-1", authorizationSnapshotRef: "snapshot-1", executionMode: "safe_active" };
const validationPolicy: ProviderPolicyContext = { ...safeActivePolicy, executionMode: "validation" };
const executionContext: ProviderExecutionContext = {
  workspaceId: "workspace-1", actionId: "action-1", authorizationId: "auth-1",
  targetNodeIds: ["node-1"], maxRequests: 128, maxRuntimeMs: 30_000,
};
const normalizationContext: ProviderNormalizationContext = { runId: "run-1", actionId: "action-1", authorizationSnapshotRef: "snapshot-1" };

const nucleiProfiles = {
  "baseline-http": ["http-missing-security-headers"],
  "misconfiguration-reviewed": ["http-cors-misconfig"],
  "known-cve-reviewed": ["CVE-2026-0001"],
} as const;

function nmapRunner(result: NmapRawResult): NmapRunner { return { run: async () => result }; }
function nucleiRunner(result: NucleiRawResult): NucleiRunner { return { run: async () => result }; }
function httpRunner(result: HttpDiscoveryRawResult): HttpDiscoveryRunner { return { run: async () => result }; }

describe("Phase 11 external provider contracts", () => {
  it("keeps process, socket, HTTP client, DNS, and browser execution out of provider adapters", async () => {
    const source = (await Promise.all([
      "packages/provider-nmap/index.ts",
      "packages/provider-nuclei/index.ts",
      "packages/provider-http-discovery/index.ts",
    ].map((file) => readFile(path.resolve(process.cwd(), file), "utf8")))).join("\n");

    for (const forbidden of [
      /node:child_process/, /node:net/, /node:dns/, /node:http/, /node:https/,
      /\bfetch\s*\(/, /\bspawn\s*\(/, /\bexec(File)?\s*\(/, /playwright/i, /puppeteer/i, /shell\s*:\s*true/,
    ]) expect(source).not.toMatch(forbidden);
  });

  it("rejects Nmap native arguments and out-of-scope target binding", async () => {
    const provider = createNmapProvider(nmapRunner({ capabilityId: "network.port.discover.v1", actionId: "action-1", targetNodeId: "node-1", records: [] }));
    expect(provider.validateRequest({
      capabilityId: "network.port.discover.v1", targetNodeId: "node-1", portProfile: "top-100", timingProfile: "polite", providerNativeArgs: ["-A"],
    } as never, safeActivePolicy)).toEqual({ ok: false, code: "NMAP_REQUEST_INVALID" });
    await expect(provider.execute({
      capabilityId: "network.port.discover.v1", targetNodeId: "node-2", portProfile: "top-100", timingProfile: "polite",
    }, executionContext, new AbortController().signal)).rejects.toThrow("NMAP_TARGET_BINDING_INVALID");
  });

  it("normalizes deterministic evidence-backed Nmap observations", async () => {
    const provider = createNmapProvider(nmapRunner({ capabilityId: "network.port.discover.v1", actionId: "action-1", targetNodeId: "node-1", records: [] }));
    const raw: NmapRawResult = {
      capabilityId: "network.port.discover.v1", actionId: "action-1", targetNodeId: "node-1",
      records: [
        { targetNodeId: "node-1", port: 443, protocol: "tcp", state: "open", service: "https", evidenceRef: "e-443", observedAt: "2026-09-18T00:00:00Z" },
        { targetNodeId: "node-1", port: 80, protocol: "tcp", state: "open", service: "http", evidenceRef: "e-80", observedAt: "2026-09-18T00:00:00Z" },
      ],
    };
    const first = await provider.normalize(raw, normalizationContext);
    expect(await provider.normalize(raw, normalizationContext)).toEqual(first);
    expect(first.map((item) => item.facts.port)).toEqual([80, 443]);
    expect(first.every((item) => /^phase11-obs-nmap:[0-9a-f]{64}$/.test(item.observationId))).toBe(true);
  });

  it("uses bounded stable IDs for approved Nuclei observations", async () => {
    const provider = createNucleiProvider(nucleiRunner({
      capabilityId: "web.template.validate.v1",
      actionId: "action-1",
      targetNodeId: "node-1",
      templateProfile: "baseline-http",
      minimumSeverity: "low",
      matches: [{
        targetNodeId: "node-1",
        templateId: "http-missing-security-headers",
        severity: "medium",
        evidenceRef: "e-approved",
        observedAt: "2026-09-18T00:00:00Z",
      }],
    }), { profiles: nucleiProfiles });

    const observations = await provider.normalize({
      capabilityId: "web.template.validate.v1",
      actionId: "action-1",
      targetNodeId: "node-1",
      templateProfile: "baseline-http",
      minimumSeverity: "low",
      matches: [{
        targetNodeId: "node-1",
        templateId: "http-missing-security-headers",
        severity: "medium",
        evidenceRef: "e-approved",
        observedAt: "2026-09-18T00:00:00Z",
      }],
    }, normalizationContext);

    expect(observations[0]?.observationId).toMatch(/^phase11-obs-nuclei:[0-9a-f]{64}$/);
  });

  it("keeps Nuclei selection on reviewed code-owned profiles", async () => {
    let received: readonly string[] = [];
    const provider = createNucleiProvider({
      run: async (request) => {
        received = request.approvedTemplateIds;
        return { capabilityId: "web.template.validate.v1", actionId: "action-1", targetNodeId: request.targetNodeId, templateProfile: request.templateProfile, minimumSeverity: request.minimumSeverity, matches: [] };
      },
    }, { profiles: nucleiProfiles });
    expect(provider.validateRequest({
      capabilityId: "web.template.validate.v1", targetNodeId: "node-1", templateProfile: "baseline-http", minimumSeverity: "low", templatePath: "/tmp/arbitrary.yaml",
    } as never, validationPolicy)).toEqual({ ok: false, code: "NUCLEI_REQUEST_INVALID" });
    await provider.execute({
      capabilityId: "web.template.validate.v1", targetNodeId: "node-1", templateProfile: "baseline-http", minimumSeverity: "low",
    }, executionContext, new AbortController().signal);
    expect(received).toEqual(["http-missing-security-headers"]);
  });

  it("rejects Nuclei output from outside the selected reviewed profile", async () => {
    const provider = createNucleiProvider(nucleiRunner({
      capabilityId: "web.template.validate.v1", actionId: "action-1", targetNodeId: "node-1", templateProfile: "baseline-http", minimumSeverity: "low",
      matches: [{ targetNodeId: "node-1", templateId: "CVE-2026-0001", severity: "high", evidenceRef: "e-1", observedAt: "2026-09-18T00:00:00Z" }],
    }), { profiles: nucleiProfiles });
    const raw = await provider.execute({ capabilityId: "web.template.validate.v1", targetNodeId: "node-1", templateProfile: "baseline-http", minimumSeverity: "low" }, executionContext, new AbortController().signal);
    await expect(provider.normalize(raw, normalizationContext)).rejects.toThrow("NUCLEI_TEMPLATE_NOT_APPROVED");
  });

  it("rejects HTTP planner URLs and normalizes only privacy-reduced route facts", async () => {
    const provider = createHttpDiscoveryProvider(httpRunner({
      capabilityId: "web.route.discover.v1", actionId: "action-1", targetNodeId: "node-1", discoveryProfile: "well-known-safe", records: [],
    }));
    expect(provider.validateRequest({
      capabilityId: "web.http.probe.v1", targetNodeId: "node-1", discoveryProfile: "root-only", methodProfile: "HEAD_THEN_GET", followSameOriginRedirects: false, url: "https://attacker.invalid/",
    } as never, safeActivePolicy)).toEqual({ ok: false, code: "HTTP_DISCOVERY_REQUEST_INVALID" });
    const observations = await provider.normalize({
      capabilityId: "web.route.discover.v1", actionId: "action-1", targetNodeId: "node-1", discoveryProfile: "well-known-safe",
      records: [{ targetNodeId: "node-1", routeKind: "security-txt", status: 200, contentType: "text/plain", evidenceRef: "e-security", observedAt: "2026-09-18T00:00:00Z" }],
    }, normalizationContext);
    expect(observations[0]).toMatchObject({ providerId: "scopeforge.http-discovery", capabilityId: "web.route.discover.v1", evidenceRefs: ["e-security"], executionMode: "safe_active" });
    expect(observations[0]?.observationId).toMatch(/^phase11-obs-http:[0-9a-f]{64}$/);
    expect(JSON.stringify(observations)).not.toMatch(/https?:\/\//);
  });
});
