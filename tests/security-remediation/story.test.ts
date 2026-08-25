import { describe, expect, it } from "vitest";
import type {
  Database,
  SecurityFindingRetestRow,
  SecurityFindingRow,
  SecurityFindingWorkRow,
} from "@/lib/database.types";
import { buildSecurityStoryV1 } from "@/lib/security-remediation/story";

type SecurityEvidenceRow = Database["public"]["Tables"]["security_evidence"]["Row"];
type SecurityFindingOccurrenceRow = Database["public"]["Tables"]["security_finding_occurrences"]["Row"];
type SecurityFindingEventRow = Database["public"]["Tables"]["security_finding_events"]["Row"];

function finding(overrides: Partial<SecurityFindingRow> = {}): SecurityFindingRow {
  return {
    workspace_id: "workspace-1",
    finding_id: "finding-1",
    asset_id: "asset-1",
    source_kind: "deterministic-runtime-scanner",
    source_id: "scopeforge:runtime-observer",
    source_version: "0.1",
    rule_ref: "runtime:test",
    title: "Missing security header",
    description: "The response did not expose the expected defensive header.",
    severity: "medium",
    confidence: "high",
    validation_state: "runtime_observed",
    provenance_kind: "scanner-derived",
    location: null,
    taxonomy: { cwe: ["CWE-693"], owasp: ["A05:2021"] },
    remediation: {
      summary: "Return the defensive header on the affected endpoint.",
      actions: [
        { title: "Set header", description: "Configure the application to emit the header." },
      ],
      verification: { summary: "Run a fresh deterministic observation." },
    },
    lifecycle_state: "in_progress",
    first_seen_at: "2026-08-25T00:00:00.000Z",
    last_seen_at: "2026-08-25T00:05:00.000Z",
    last_seen_job_id: "job-1",
    created_at: "2026-08-25T00:00:00.000Z",
    updated_at: "2026-08-25T00:05:00.000Z",
    ...overrides,
  };
}

function evidence(index: number, overrides: Partial<SecurityEvidenceRow> = {}): SecurityEvidenceRow {
  return {
    workspace_id: "workspace-1",
    evidence_id: `evidence-${index}`,
    asset_id: "asset-1",
    kind: "http-observation",
    provenance_kind: index % 2 === 0 ? "observed" : "scanner-derived",
    summary: `Evidence ${index}: ${"x".repeat(700)}`,
    classification: "public",
    artifact_ref: null,
    created_at: `2026-08-25T00:${String(index).padStart(2, "0")}:00.000Z`,
    ...overrides,
  };
}

function occurrence(overrides: Partial<SecurityFindingOccurrenceRow> = {}): SecurityFindingOccurrenceRow {
  return {
    id: "occurrence-1",
    workspace_id: "workspace-1",
    finding_id: "finding-1",
    asset_id: "asset-1",
    scan_job_id: "job-1",
    scan_run_ref: null,
    observed_at: "2026-08-25T00:05:00.000Z",
    source_kind: "deterministic-runtime-scanner",
    source_id: "scopeforge:runtime-observer",
    source_version: "0.1",
    validation_state: "runtime_observed",
    created_at: "2026-08-25T00:05:00.000Z",
    ...overrides,
  };
}

function event(overrides: Partial<SecurityFindingEventRow> = {}): SecurityFindingEventRow {
  return {
    id: "event-1",
    workspace_id: "workspace-1",
    finding_id: "finding-1",
    scan_job_id: null,
    actor_type: "system",
    actor_id: null,
    event_type: "finding.reobserved",
    from_lifecycle: null,
    to_lifecycle: null,
    reason: null,
    metadata: {},
    created_at: "2026-08-25T00:05:00.000Z",
    ...overrides,
  };
}

function work(overrides: Partial<SecurityFindingWorkRow> = {}): SecurityFindingWorkRow {
  return {
    workspace_id: "workspace-1",
    finding_id: "finding-1",
    assignee_user_id: "user-2",
    remediation_note: "Patch is deployed to staging and ready for a fresh retest.",
    updated_by: "user-1",
    created_at: "2026-08-25T00:06:00.000Z",
    updated_at: "2026-08-25T00:07:00.000Z",
    ...overrides,
  };
}

function retest(overrides: Partial<SecurityFindingRetestRow> = {}): SecurityFindingRetestRow {
  return {
    id: "retest-1",
    workspace_id: "workspace-1",
    finding_id: "finding-1",
    asset_id: "asset-1",
    requested_by: "user-1",
    execution_kind: "passive_runtime",
    source_id: "scopeforge:runtime-observer",
    source_version: "0.1",
    rule_ref: "runtime:test",
    validation_profile_id: null,
    validation_profile_version: null,
    active_consent_granted_at: null,
    status: "inconclusive",
    scan_job_id: "job-2",
    result_code: "job_blocked",
    requested_at: "2026-08-25T00:10:00.000Z",
    started_at: "2026-08-25T00:11:00.000Z",
    completed_at: "2026-08-25T00:12:00.000Z",
    ...overrides,
  };
}

function storyInput(overrides: Partial<Parameters<typeof buildSecurityStoryV1>[0]> = {}) {
  return {
    finding: finding(),
    evidence: [evidence(1)],
    occurrences: [occurrence()],
    events: [event()],
    work: work(),
    retests: [retest()],
    ...overrides,
  };
}

describe("buildSecurityStoryV1", () => {
  it("labels provenance, bounds evidence, and never copies raw response-shaped fields", () => {
    const rows = Array.from({ length: 25 }, (_, index) => evidence(index));
    const tainted = {
      ...rows[0],
      responseBody: "TOP_SECRET_BODY",
      headers: { authorization: "Bearer secret" },
      cookie: "session=secret",
    } as SecurityEvidenceRow;
    rows[0] = tainted;

    const story = buildSecurityStoryV1(storyInput({ evidence: rows }));

    expect(story.evidence).toHaveLength(20);
    expect(story.evidence[0]?.provenanceLabel).toMatch(/observed|scanner-derived/i);
    expect(story.evidence.every((item) => item.summary.length <= 500)).toBe(true);
    const serialized = JSON.stringify(story);
    expect(serialized).not.toContain("TOP_SECRET_BODY");
    expect(serialized).not.toContain("Bearer secret");
    expect(serialized).not.toContain("session=secret");
  });

  it("combines canonical remediation guidance with current operator assignment and note", () => {
    const story = buildSecurityStoryV1(storyInput());

    expect(story.remediation.guidance).toContain("Return the defensive header");
    expect(story.remediation.assigneeUserId).toBe("user-2");
    expect(story.remediation.note).toContain("deployed to staging");
    expect(story.remediation.provenanceLabel).toMatch(/operator/i);
  });

  it("selects the newest retest deterministically even when input history is unsorted", () => {
    const older = retest({
      id: "older",
      status: "failed",
      result_code: "execution_failed",
      requested_at: "2026-08-25T00:08:00.000Z",
      completed_at: "2026-08-25T00:09:00.000Z",
    });
    const newer = retest({
      id: "newer",
      status: "inconclusive",
      result_code: "source_drift",
      requested_at: "2026-08-25T00:20:00.000Z",
      completed_at: "2026-08-25T00:21:00.000Z",
    });

    const story = buildSecurityStoryV1(storyInput({ retests: [older, newer] }));

    expect(story.verification.latestRetestId).toBe("newer");
    expect(story.verification.status).toBe("inconclusive");
  });

  it("uses verified fixed wording only when canonical lifecycle and latest authoritative retest both agree", () => {
    const verified = retest({
      id: "verified",
      status: "verified_fixed",
      result_code: "verified_fixed",
      requested_at: "2026-08-25T00:20:00.000Z",
      completed_at: "2026-08-25T00:21:00.000Z",
    });
    const stillPresent = retest({
      id: "present",
      status: "still_present",
      result_code: "still_present",
      requested_at: "2026-08-25T00:20:00.000Z",
      completed_at: "2026-08-25T00:21:00.000Z",
    });

    const lifecycleOnly = buildSecurityStoryV1(storyInput({
      finding: finding({ lifecycle_state: "verified_fixed" }),
      retests: [stillPresent],
    }));
    const retestOnly = buildSecurityStoryV1(storyInput({
      finding: finding({ lifecycle_state: "retest_pending" }),
      retests: [verified],
    }));
    const authoritative = buildSecurityStoryV1(storyInput({
      finding: finding({ lifecycle_state: "verified_fixed" }),
      retests: [verified],
    }));

    expect(JSON.stringify(lifecycleOnly).toLowerCase()).not.toContain("verified fixed");
    expect(JSON.stringify(retestOnly).toLowerCase()).not.toContain("verified fixed");
    expect(JSON.stringify(authoritative).toLowerCase()).toContain("verified fixed");
    expect(authoritative.verification.verified).toBe(true);
  });
});
