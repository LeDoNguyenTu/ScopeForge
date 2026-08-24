import { describe, expect, it } from "vitest";
import {
  assetRef,
  evidenceId,
  ruleRef,
  scanRunRef,
  securityFindingId,
  type EvidenceRecord,
  type SecurityFinding,
} from "@/packages/security-domain";
import { prepareFindingIngestionBatch } from "@/lib/security-findings/ingestion";

const asset = assetRef("asset-1");
const evidence: EvidenceRecord = {
  id: evidenceId("runtime-evidence:1"),
  kind: "http-observation",
  provenance: { kind: "observed" },
  summary: "Strict-Transport-Security was not observed.",
  classification: "public",
};

const finding: SecurityFinding = {
  id: securityFindingId("runtime:1"),
  source: {
    kind: "deterministic-runtime-scanner",
    sourceId: "scopeforge:runtime-observer",
    sourceVersion: "0.1",
  },
  rule: ruleRef("runtime-rule:runtime/http/missing-hsts@0.1"),
  title: "Missing HSTS",
  description: "The observed response did not include HSTS.",
  severity: "low",
  confidence: "high",
  validation: "runtime_observed",
  provenance: { kind: "scanner-derived" },
  evidenceRefs: [evidence.id],
  assetRef: asset,
  taxonomy: { cwe: [], owasp: [], references: [] },
  lifecycle: "open",
};

function prepare(overrides?: Partial<Parameters<typeof prepareFindingIngestionBatch>[0]>) {
  return prepareFindingIngestionBatch({
    workspaceId: "workspace-1",
    assetId: "asset-1",
    scanJobId: "job-1",
    observedAt: new Date("2026-08-25T00:00:00.000Z"),
    findings: [finding],
    evidence: [evidence],
    ...overrides,
  });
}

describe("prepareFindingIngestionBatch", () => {
  it("serializes only canonical bounded runtime data without scanner lifecycle authority", () => {
    const prepared = prepare();

    expect(prepared).toMatchObject({
      workspaceId: "workspace-1",
      assetId: "asset-1",
      scanJobId: "job-1",
      observedAt: "2026-08-25T00:00:00.000Z",
    });
    expect(prepared.findings).toEqual([expect.objectContaining({
      finding_id: "runtime:1",
      source_kind: "deterministic-runtime-scanner",
      source_id: "scopeforge:runtime-observer",
      source_version: "0.1",
      rule_ref: "runtime-rule:runtime/http/missing-hsts@0.1",
      validation_state: "runtime_observed",
      provenance_kind: "scanner-derived",
      evidence_refs: ["runtime-evidence:1"],
    })]);
    expect(JSON.stringify(prepared.findings)).not.toContain("lifecycle_state");
    expect(prepared.evidence).toEqual([expect.objectContaining({
      evidence_id: "runtime-evidence:1",
      kind: "http-observation",
      provenance_kind: "observed",
      classification: "public",
    })]);
  });

  it("rejects findings that do not belong to the requested asset", () => {
    expect(() => prepare({ findings: [{ ...finding, assetRef: assetRef("asset-2") }] }))
      .toThrow(/asset/i);
  });

  it("rejects missing referenced evidence", () => {
    expect(() => prepare({ evidence: [] })).toThrow(/evidence/i);
  });

  it("rejects conflicting duplicate evidence identities", () => {
    const conflict: EvidenceRecord = { ...evidence, summary: "different" };
    expect(() => prepare({ evidence: [evidence, conflict] })).toThrow(/evidence/i);
  });

  it("rejects non-runtime or inferred finding authority", () => {
    expect(() => prepare({ findings: [{
      ...finding,
      source: { ...finding.source, kind: "advisory-inference" },
    }] })).toThrow(/runtime/i);

    expect(() => prepare({ findings: [{
      ...finding,
      provenance: { kind: "inferred" },
    }] })).toThrow(/provenance/i);
  });

  it("rejects non-public, non-observed, or unsupported runtime evidence", () => {
    expect(() => prepare({ evidence: [{ ...evidence, classification: "secret" }] }))
      .toThrow(/public/i);
    expect(() => prepare({ evidence: [{ ...evidence, provenance: { kind: "scanner-derived" } }] }))
      .toThrow(/observed/i);
    expect(() => prepare({ evidence: [{ ...evidence, kind: "static-analysis" }] }))
      .toThrow(/evidence kind/i);
  });

  it("enforces durable text and payload bounds before SQL", () => {
    expect(() => prepare({ findings: [{ ...finding, description: "x".repeat(8_193) }] }))
      .toThrow(/description/i);
    expect(() => prepare({ evidence: [{ ...evidence, summary: "x".repeat(4_097) }] }))
      .toThrow(/summary/i);
    expect(() => prepare({ findings: [{
      ...finding,
      taxonomy: { ...finding.taxonomy, references: ["x".repeat(20_000)] },
    }] })).toThrow(/taxonomy/i);
    expect(() => prepare({ findings: [{
      ...finding,
      source: { ...finding.source, scanRunRef: scanRunRef("x".repeat(257)) },
    }] })).toThrow(/scan run reference/i);
  });
});
