import { describe, expect, it } from "vitest";
import type { HostedPhase3EnvelopeV1 } from "@/packages/scanner-output/hosted/types";
import { deriveHostedPhase3PersistenceRows } from "@/lib/phase3-results/normalization";

const ASSET_ID = "11111111-1111-4111-8111-111111111111";

const envelope: HostedPhase3EnvelopeV1 = {
  schemaVersion: 1,
  tool: { name: "ScopeForge", version: "0.1.0" },
  repository: { canonicalUrl: "https://github.com/octocat/Hello-World" },
  runRef: `sfh1:${"a".repeat(64)}`,
  scan: {
    startedAt: "2026-08-27T00:00:00.000Z",
    durationMs: 1000,
    scanners: ["sca@1.0.0", "secrets@1.0.0"],
    scannerErrorCount: 0,
  },
  inventory: { filesAnalyzed: 2, filesSkipped: 0, totalBytes: 1024 },
  findings: [
    {
      fingerprint: `sf1:${"b".repeat(64)}`,
      scanner: "sca",
      ruleId: "sca/known-vulnerability",
      ruleVersion: "1.0.0",
      title: "Known vulnerable dependency",
      description: "A dependency version matches a reviewed vulnerability source.",
      severity: "high",
      confidence: "high",
      validation: "static_confirmed",
      location: { path: "package-lock.json", line: 1, startColumn: 1, endColumn: 2 },
      evidence: { summary: "Dependency evidence." },
      taxonomy: { cwe: ["CWE-1104"], owasp: [], references: [] },
      remediation: {
        summary: "Upgrade the dependency.",
        guidance: "Upgrade to a fixed release.",
        verification: "Run the scanner again.",
      },
    },
    {
      fingerprint: `sfs1:${"c".repeat(64)}`,
      scanner: "secrets",
      ruleId: "secrets/github-token",
      ruleVersion: "1.0.0",
      title: "GitHub token exposed",
      description: "A GitHub credential is present in repository content.",
      severity: "high",
      confidence: "high",
      validation: "static_confirmed",
      location: { path: "src/config.ts", line: 7 },
      evidence: { summary: "Detected by secrets/github-token." },
      taxonomy: { cwe: ["CWE-798"], owasp: [], references: [] },
      remediation: {
        summary: "Rotate the credential.",
        guidance: "Revoke the credential and remove it from source.",
        verification: "Run the scanner again after rotation.",
      },
    },
  ],
};

describe("shared deterministic Phase 3 persistence normalization", () => {
  it("preserves the Phase 5C finding and evidence authority model for hosted scanner results", () => {
    const rows = deriveHostedPhase3PersistenceRows(ASSET_ID, envelope);

    expect(rows.findings).toHaveLength(2);
    expect(rows.evidence).toHaveLength(2);
    expect(rows.findings[0]).toMatchObject({
      source_kind: "deterministic-passive-scanner",
      source_id: "scopeforge:sca:sca/known-vulnerability",
      source_version: "1.0.0",
      scan_run_ref: envelope.runRef,
      rule_ref: "phase3-rule:sca/known-vulnerability@1.0.0",
      validation_state: "static_confirmed",
      provenance_kind: "scanner-derived",
      location: {
        path: "package-lock.json",
        start: { line: 1, column: 1 },
        end: { line: 1, column: 2 },
      },
    });
    expect(rows.evidence[0]).toMatchObject({
      kind: "dependency",
      provenance_kind: "scanner-derived",
      classification: "internal",
      artifact_ref: null,
    });
    expect(rows.findings[1]).toMatchObject({
      source_kind: "deterministic-passive-scanner",
      source_id: "scopeforge:secrets:secrets/github-token",
      location: {
        path: "src/config.ts",
        start: { line: 7 },
      },
    });
    expect(rows.evidence[1]).toMatchObject({
      kind: "static-analysis",
      classification: "internal",
      artifact_ref: null,
    });
  });

  it("derives stable server-side finding and evidence identities", () => {
    const first = deriveHostedPhase3PersistenceRows(ASSET_ID, envelope);
    const second = deriveHostedPhase3PersistenceRows(ASSET_ID, envelope);

    expect(first).toEqual(second);
    for (const finding of first.findings) {
      expect(finding.finding_id).toMatch(/^sff1:[a-f0-9]{64}$/);
      expect(finding.evidence_refs).toHaveLength(1);
    }
    for (const evidence of first.evidence) {
      expect(evidence.evidence_id).toMatch(/^sfe1:[a-f0-9]{64}$/);
    }
  });
});