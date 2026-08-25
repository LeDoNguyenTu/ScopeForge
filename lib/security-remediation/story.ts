import type { Json, SecurityFindingRetestRow } from "@/lib/database.types";
import type {
  SecurityStoryEvidenceItem,
  SecurityStoryInput,
  SecurityStoryV1,
} from "./types";

const MAX_EVIDENCE_ITEMS = 20;
const MAX_EVIDENCE_SUMMARY_CHARS = 500;
const MAX_STORY_TEXT_CHARS = 1000;

function truncate(value: string, maxChars: number): string {
  const normalized = value.trim();
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
}

function provenanceLabel(kind: string): string {
  switch (kind) {
    case "observed":
      return "Observed evidence";
    case "scanner-derived":
      return "Scanner-derived evidence";
    case "user-confirmed":
      return "User-confirmed evidence";
    case "inferred":
      return "Advisory inferred evidence";
    default:
      return "Recorded evidence";
  }
}

function isJsonRecord(value: Json | null): value is { [key: string]: Json | undefined } {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function remediationGuidance(remediation: Json | null): string {
  if (isJsonRecord(remediation) && typeof remediation.summary === "string") {
    const summary = truncate(remediation.summary, MAX_STORY_TEXT_CHARS);
    if (summary.length > 0) return summary;
  }
  return "Follow the canonical finding guidance, then run a supported deterministic retest.";
}

function newestRetest(
  retests: readonly SecurityFindingRetestRow[],
): SecurityFindingRetestRow | null {
  let newest: SecurityFindingRetestRow | null = null;

  for (const candidate of retests) {
    if (!newest) {
      newest = candidate;
      continue;
    }

    const candidateKey = `${candidate.requested_at}\u0000${candidate.completed_at ?? ""}\u0000${candidate.id}`;
    const newestKey = `${newest.requested_at}\u0000${newest.completed_at ?? ""}\u0000${newest.id}`;
    if (candidateKey > newestKey) newest = candidate;
  }

  return newest;
}

function verificationSummary(
  latestRetest: SecurityFindingRetestRow | null,
  verified: boolean,
): string {
  if (verified) {
    return "A fresh deterministic retest verified fixed status for the canonical finding.";
  }
  if (!latestRetest) {
    return "No authoritative deterministic retest has been recorded yet.";
  }

  switch (latestRetest.status) {
    case "still_present":
      return "The latest deterministic retest still observed the finding.";
    case "inconclusive":
      return "The latest deterministic retest was inconclusive and did not verify a fix.";
    case "failed":
      return "The latest deterministic retest failed and did not verify a fix.";
    case "cancelled":
      return "The latest deterministic retest was cancelled and did not verify a fix.";
    case "requested":
    case "running":
      return "A deterministic retest is pending completion.";
    case "verified_fixed":
      return "The latest retest recorded a fixed result, but canonical lifecycle has not independently confirmed it.";
  }
}

export function buildSecurityStoryV1(input: SecurityStoryInput): SecurityStoryV1 {
  const evidence: readonly SecurityStoryEvidenceItem[] = Object.freeze(
    input.evidence.slice(0, MAX_EVIDENCE_ITEMS).map((row) => Object.freeze({
      evidenceId: row.evidence_id,
      kind: row.kind,
      summary: truncate(row.summary, MAX_EVIDENCE_SUMMARY_CHARS),
      classification: row.classification,
      provenanceLabel: provenanceLabel(row.provenance_kind),
    })),
  );

  const latestRetest = newestRetest(input.retests);
  const verified = input.finding.lifecycle_state === "verified_fixed"
    && latestRetest?.status === "verified_fixed"
    && latestRetest.result_code === "verified_fixed";

  const observationCount = input.occurrences.length;
  const eventCount = input.events.length;
  const summaryParts = [
    truncate(input.finding.title, 300),
    `${input.finding.severity} severity`,
    `${input.finding.confidence} confidence`,
    `${observationCount} recorded occurrence${observationCount === 1 ? "" : "s"}`,
    `${eventCount} lifecycle event${eventCount === 1 ? "" : "s"}`,
  ];
  if (verified) summaryParts.push("verified fixed by fresh deterministic retest");

  const remediationNote = input.work?.remediation_note
    ? truncate(input.work.remediation_note, MAX_STORY_TEXT_CHARS)
    : null;

  return Object.freeze({
    summary: truncate(summaryParts.join(" - "), MAX_STORY_TEXT_CHARS),
    evidence,
    impact: truncate(
      `${input.finding.description} Severity is ${input.finding.severity} with ${input.finding.confidence} confidence.`,
      MAX_STORY_TEXT_CHARS,
    ),
    remediation: Object.freeze({
      guidance: remediationGuidance(input.finding.remediation),
      assigneeUserId: input.work?.assignee_user_id ?? null,
      note: remediationNote,
      provenanceLabel: input.work ? "Operator workflow state" : "Canonical remediation guidance",
    }),
    verification: Object.freeze({
      status: latestRetest?.status ?? "not_run",
      verified,
      latestRetestId: latestRetest?.id ?? null,
      resultCode: latestRetest?.result_code ?? null,
      provenanceLabel: latestRetest ? "Deterministic retest record" : "No retest evidence",
      summary: verificationSummary(latestRetest, verified),
    }),
  });
}
