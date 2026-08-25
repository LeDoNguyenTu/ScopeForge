import { describe, expect, it } from "vitest";
import type { SecurityFindingRow } from "../../lib/database.types";
import { resolveRetestSource } from "../../lib/security-remediation/source-registry";

function finding(overrides: Partial<SecurityFindingRow>): SecurityFindingRow {
  return {
    workspace_id: "workspace-1",
    finding_id: "finding-1",
    asset_id: "asset-1",
    source_kind: "deterministic-runtime-scanner",
    source_id: "scopeforge:runtime-observer",
    source_version: "0.1",
    rule_ref: "runtime:test",
    title: "Test finding",
    description: "Test description",
    severity: "medium",
    confidence: "high",
    validation_state: "runtime_observed",
    provenance_kind: "scanner-derived",
    location: null,
    taxonomy: {},
    remediation: null,
    lifecycle_state: "resolved",
    first_seen_at: "2026-08-25T00:00:00.000Z",
    last_seen_at: "2026-08-25T00:00:00.000Z",
    last_seen_job_id: "job-1",
    created_at: "2026-08-25T00:00:00.000Z",
    updated_at: "2026-08-25T00:00:00.000Z",
    ...overrides,
  };
}

describe("resolveRetestSource", () => {
  it("maps only the emitted passive runtime observer version to passive_runtime", () => {
    expect(resolveRetestSource(finding({ source_id: "scopeforge:runtime-observer" }))).toEqual({
      executionKind: "passive_runtime",
      sourceId: "scopeforge:runtime-observer",
      sourceVersion: "0.1",
      validationProfileId: null,
      validationProfileVersion: null,
    });
  });

  it("rejects unsupported passive runtime observer versions", () => {
    expect(
      resolveRetestSource(
        finding({
          source_id: "scopeforge:runtime-observer",
          source_version: "0.1.0",
        }),
      ),
    ).toBeNull();
  });

  it("maps only cors-origin-policy@1 validator findings to active_validation", () => {
    expect(
      resolveRetestSource(
        finding({
          source_id: "scopeforge:runtime-validator",
          source_version: "cors-origin-policy@1",
          rule_ref: "cors-origin-policy@1:cors-untrusted-origin-allowed",
          validation_state: "runtime_validated",
        }),
      ),
    ).toEqual({
      executionKind: "active_validation",
      sourceId: "scopeforge:runtime-validator",
      sourceVersion: "cors-origin-policy@1",
      validationProfileId: "cors-origin-policy",
      validationProfileVersion: 1,
    });
  });

  it("rejects unsupported runtime validator versions", () => {
    expect(
      resolveRetestSource(
        finding({
          source_id: "scopeforge:runtime-validator",
          source_version: "cors-origin-policy@2",
        }),
      ),
    ).toBeNull();
  });

  it.each([
    "external-scanner",
    "user-confirmed",
    "advisory-inference",
  ] as const)("rejects %s findings", (sourceKind) => {
    expect(resolveRetestSource(finding({ source_kind: sourceKind }))).toBeNull();
  });

  it("rejects unknown deterministic source ids", () => {
    expect(resolveRetestSource(finding({ source_id: "scopeforge:unknown" }))).toBeNull();
  });

  it("returns descriptors with no request authority fields", () => {
    const descriptor = resolveRetestSource(finding({}));
    expect(descriptor).not.toBeNull();
    expect(Object.keys(descriptor ?? {}).sort()).toEqual([
      "executionKind",
      "sourceId",
      "sourceVersion",
      "validationProfileId",
      "validationProfileVersion",
    ]);
    expect(descriptor).not.toHaveProperty("url");
    expect(descriptor).not.toHaveProperty("method");
    expect(descriptor).not.toHaveProperty("headers");
    expect(descriptor).not.toHaveProperty("body");
    expect(descriptor).not.toHaveProperty("budget");
  });
});
