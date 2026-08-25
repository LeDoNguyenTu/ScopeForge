import { describe, expect, it, vi } from "vitest";
import type { HostedPhase3EnvelopeV1 } from "@/packages/scanner-output/hosted/types";
import {
  createHostedEvidenceIdentity,
  createHostedFindingIdentity,
} from "@/packages/scanner-output/hosted/identity";
import {
  importHostedPhase3Result,
  Phase3ImportWorkflowError,
  type Phase3ImportRepositoryContract,
} from "@/lib/phase3-import/service";

const runRef = `sfh1:${"a".repeat(64)}`;

function envelope(overrides: Partial<HostedPhase3EnvelopeV1> = {}): HostedPhase3EnvelopeV1 {
  return {
    schemaVersion: 1,
    tool: { name: "scopeforge", version: "0.1.0" },
    repository: { canonicalUrl: "https://github.com/acme/example" },
    runRef,
    scan: {
      startedAt: "2026-08-26T00:00:00.000Z",
      durationMs: 125,
      scanners: ["jsts@1.0.0"],
      scannerErrorCount: 0,
    },
    inventory: {
      filesAnalyzed: 12,
      filesSkipped: 1,
      totalBytes: 4096,
    },
    findings: [
      {
        fingerprint: `sf1:${"b".repeat(64)}`,
        scanner: "jsts",
        ruleId: "jsts/command-injection",
        ruleVersion: "1.0.0",
        title: "Command injection",
        description: "Untrusted input reaches a command execution sink.",
        severity: "high",
        confidence: "high",
        validation: "static_confirmed",
        location: {
          path: "src/app.ts",
          line: 7,
          startColumn: 3,
          endColumn: 20,
        },
        evidence: { summary: "Request input reaches child_process.exec." },
        taxonomy: {
          cwe: ["CWE-78"],
          owasp: ["A03:2021"],
          references: [],
        },
        remediation: {
          summary: "Avoid shell command construction.",
          guidance: "Use an allowlisted argument API instead of a shell string.",
          verification: "Rerun ScopeForge and confirm the data flow is removed.",
        },
      },
    ],
    ...overrides,
  };
}

function repository(overrides: Partial<Phase3ImportRepositoryContract> = {}): Phase3ImportRepositoryContract {
  return {
    loadAsset: vi.fn(async () => ({
      id: "asset-1",
      workspace_id: "workspace-1",
      kind: "repository",
      canonical_target: "https://github.com/acme/example",
    })),
    persist: vi.fn(async () => ({
      importRunId: "import-1",
      scanJobId: "job-1",
      replayed: false,
    })),
    ...overrides,
  };
}

function input(role: "owner" | "admin" | "member" | "viewer" = "member") {
  return {
    actorId: "user-1",
    workspaceId: "workspace-1",
    role,
    assetId: "asset-1",
    envelope: envelope(),
  } as const;
}

describe("importHostedPhase3Result", () => {
  it("rejects viewers before loading or mutating repository state", async () => {
    const repo = repository();

    await expect(importHostedPhase3Result(input("viewer"), { repository: repo })).rejects.toMatchObject({
      code: "PHASE3_IMPORT_FORBIDDEN",
    });
    expect(repo.loadAsset).not.toHaveBeenCalled();
    expect(repo.persist).not.toHaveBeenCalled();
  });

  it("rejects unavailable, cross-workspace, non-repository, and repository-mismatched assets", async () => {
    for (const selectedAsset of [
      null,
      { id: "asset-1", workspace_id: "workspace-2", kind: "repository", canonical_target: "https://github.com/acme/example" },
      { id: "asset-1", workspace_id: "workspace-1", kind: "web_application", canonical_target: "https://github.com/acme/example" },
      { id: "asset-1", workspace_id: "workspace-1", kind: "repository", canonical_target: "https://github.com/acme/other" },
    ] as const) {
      const repo = repository({ loadAsset: vi.fn(async () => selectedAsset) });
      await expect(importHostedPhase3Result(input(), { repository: repo })).rejects.toBeInstanceOf(Phase3ImportWorkflowError);
      expect(repo.persist).not.toHaveBeenCalled();
    }
  });

  it("derives trusted source, evidence, identity, location and remediation rows before persistence", async () => {
    const repo = repository();
    const result = await importHostedPhase3Result(input(), { repository: repo });

    expect(result).toEqual({ importRunId: "import-1", scanJobId: "job-1", replayed: false });
    expect(repo.persist).toHaveBeenCalledTimes(1);

    const persisted = vi.mocked(repo.persist).mock.calls[0]?.[0];
    expect(persisted).toBeDefined();
    if (!persisted) return;

    const expectedFindingId = createHostedFindingIdentity({
      repositoryAssetId: "asset-1",
      fingerprint: envelope().findings[0]!.fingerprint,
      scanner: "jsts",
      ruleId: "jsts/command-injection",
      ruleVersion: "1.0.0",
    });
    const expectedEvidenceId = createHostedEvidenceIdentity({
      findingId: expectedFindingId,
      kind: "static-analysis",
      classification: "internal",
      summary: "Request input reaches child_process.exec.",
    });

    expect(persisted).toMatchObject({
      workspaceId: "workspace-1",
      assetId: "asset-1",
      actorId: "user-1",
      repositoryCanonicalUrl: "https://github.com/acme/example",
      runRef,
      toolVersion: "0.1.0",
      scanStartedAt: "2026-08-26T00:00:00.000Z",
      scanDurationMs: 125,
      scannerDescriptors: ["jsts@1.0.0"],
      scannerErrorCount: 0,
      filesAnalyzed: 12,
      filesSkipped: 1,
      totalBytes: 4096,
    });
    expect(persisted.findings).toEqual([
      {
        finding_id: expectedFindingId,
        source_kind: "deterministic-passive-scanner",
        source_id: "scopeforge:jsts:jsts/command-injection",
        source_version: "1.0.0",
        scan_run_ref: runRef,
        rule_ref: "phase3-rule:jsts/command-injection@1.0.0",
        title: "Command injection",
        description: "Untrusted input reaches a command execution sink.",
        severity: "high",
        confidence: "high",
        validation_state: "static_confirmed",
        provenance_kind: "scanner-derived",
        location: {
          path: "src/app.ts",
          start: { line: 7, column: 3 },
          end: { line: 7, column: 20 },
        },
        taxonomy: {
          cwe: ["CWE-78"],
          owasp: ["A03:2021"],
          references: [],
        },
        remediation: {
          summary: "Avoid shell command construction.",
          actions: [{
            title: "Remediation guidance",
            description: "Use an allowlisted argument API instead of a shell string.",
          }],
          verification: { summary: "Rerun ScopeForge and confirm the data flow is removed." },
        },
        evidence_refs: [expectedEvidenceId],
      },
    ]);
    expect(persisted.evidence).toEqual([
      {
        evidence_id: expectedEvidenceId,
        kind: "static-analysis",
        provenance_kind: "scanner-derived",
        summary: "Request input reaches child_process.exec.",
        classification: "internal",
        artifact_ref: null,
      },
    ]);
  });

  it("preserves secret line attribution without reconstructing hidden column spans", async () => {
    const secretEnvelope = envelope({
      scan: {
        startedAt: "2026-08-26T00:00:00.000Z",
        durationMs: 125,
        scanners: ["secrets@1.0.0"],
        scannerErrorCount: 0,
      },
      findings: [{
        ...envelope().findings[0]!,
        scanner: "secrets",
        ruleId: "secrets/github-token",
        ruleVersion: "1.0.0",
        location: { path: "src/config.ts", line: 9 },
      }],
    });
    const repo = repository();

    await importHostedPhase3Result({ ...input(), envelope: secretEnvelope }, { repository: repo });
    const persisted = vi.mocked(repo.persist).mock.calls[0]?.[0];
    expect(persisted?.findings[0]?.location).toEqual({ path: "src/config.ts", start: { line: 9 } });
    expect(JSON.stringify(persisted)).not.toContain("column");
  });

  it("returns an exact idempotent replay without adding service-side behavior", async () => {
    const repo = repository({
      persist: vi.fn(async () => ({ importRunId: "import-1", scanJobId: "job-1", replayed: true })),
    });

    await expect(importHostedPhase3Result(input(), { repository: repo })).resolves.toEqual({
      importRunId: "import-1",
      scanJobId: "job-1",
      replayed: true,
    });
  });

  it("propagates trusted run-ref conflicts and never turns them into retries", async () => {
    const repo = repository({
      persist: vi.fn(async () => {
        throw new Phase3ImportWorkflowError("PHASE3_IMPORT_RUN_REF_CONFLICT");
      }),
    });

    await expect(importHostedPhase3Result(input(), { repository: repo })).rejects.toMatchObject({
      code: "PHASE3_IMPORT_RUN_REF_CONFLICT",
    });
    expect(repo.persist).toHaveBeenCalledTimes(1);
  });
});
