import { describe, expect, it } from "vitest";
import type { HostedPhase3EnvelopeV1 } from "../scanner-output/hosted/types";
import { normalizeHostedPhase3Observations } from "./phase3";

function envelope(): HostedPhase3EnvelopeV1 {
  return {
    schemaVersion: 1,
    tool: { name: "ScopeForge", version: "0.1.0" },
    repository: { canonicalUrl: "https://github.com/example/project" },
    runRef: "run-phase3-1",
    scan: {
      startedAt: "2026-09-18T00:00:00.000Z",
      durationMs: 123,
      scanners: ["jsts"],
      scannerErrorCount: 0,
    },
    inventory: { filesAnalyzed: 1, filesSkipped: 0, totalBytes: 100 },
    findings: [{
      fingerprint: "fingerprint-1",
      scanner: "jsts",
      ruleId: "command-injection",
      ruleVersion: "1",
      title: "Sensitive title sentinel",
      description: "Sensitive description sentinel",
      severity: "high",
      confidence: "high",
      validation: "static_confirmed",
      location: { path: "src/app.ts", line: 7 },
      evidence: { summary: "SECRET_EVIDENCE_SENTINEL" },
      taxonomy: { cwe: ["CWE-78"], owasp: [], references: [] },
      remediation: {
        summary: "Sensitive remediation sentinel",
        guidance: "Sensitive guidance sentinel",
        verification: "Sensitive verification sentinel",
      },
    }],
  };
}

describe("native ScopeForge Phase 3 adapter", () => {
  it("normalizes stable provider-neutral observations with canonical evidence links", () => {
    const first = normalizeHostedPhase3Observations({
      assetNodeId: "asset-node-1",
      authorizationSnapshotRef: "authz-snapshot-1",
      envelope: envelope(),
      evidenceRefsByFingerprint: { "fingerprint-1": ["phase3-evidence-1"] },
    });
    const second = normalizeHostedPhase3Observations({
      assetNodeId: "asset-node-1",
      authorizationSnapshotRef: "authz-snapshot-1",
      envelope: envelope(),
      evidenceRefsByFingerprint: { "fingerprint-1": ["phase3-evidence-1"] },
    });

    expect(first).toEqual(second);
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({
      runId: "run-phase3-1",
      providerId: "scopeforge.phase3",
      providerVersion: "0.1.0",
      capabilityId: "source.security.finding.observe.v1",
      assetNodeIds: ["asset-node-1"],
      evidenceRefs: ["phase3-evidence-1"],
      executionMode: "passive",
    });
  });

  it("does not copy descriptions, evidence summaries, remediation text, taxonomy, or repository URL", () => {
    const observations = normalizeHostedPhase3Observations({
      assetNodeId: "asset-node-1",
      authorizationSnapshotRef: "authz-snapshot-1",
      envelope: envelope(),
      evidenceRefsByFingerprint: { "fingerprint-1": ["phase3-evidence-1"] },
    });

    const serialized = JSON.stringify(observations);
    for (const forbidden of [
      "Sensitive title sentinel",
      "Sensitive description sentinel",
      "SECRET_EVIDENCE_SENTINEL",
      "Sensitive remediation sentinel",
      "Sensitive guidance sentinel",
      "Sensitive verification sentinel",
      "CWE-78",
      "https://github.com/example/project",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("fails closed when the existing evidence reference is missing", () => {
    expect(() => normalizeHostedPhase3Observations({
      assetNodeId: "asset-node-1",
      authorizationSnapshotRef: "authz-snapshot-1",
      envelope: envelope(),
      evidenceRefsByFingerprint: {},
    })).toThrow("PHASE3_EVIDENCE_REFERENCE_REQUIRED:fingerprint-1");
  });
});
