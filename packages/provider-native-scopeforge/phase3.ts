import type { HostedPhase3EnvelopeV1 } from "../scanner-output/hosted/types";
import type { Observation, PrimitiveFacts } from "../security-planning";

export interface Phase3ObservationAdapterInput {
  assetNodeId: string;
  authorizationSnapshotRef: string;
  envelope: HostedPhase3EnvelopeV1;
  evidenceRefsByFingerprint: Readonly<Record<string, readonly string[]>>;
}

const CONFIDENCE: Readonly<Record<HostedPhase3EnvelopeV1["findings"][number]["confidence"], number>> = {
  high: 0.9,
  medium: 0.65,
  low: 0.4,
};

function stableObservationId(runRef: string, fingerprint: string): string {
  return [
    "phase11",
    "phase3",
    encodeURIComponent(runRef),
    encodeURIComponent(fingerprint.trim().toLowerCase()),
  ].join(":");
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values.map((value) => value.trim()).filter(Boolean))].sort());
}

function factsForFinding(
  finding: HostedPhase3EnvelopeV1["findings"][number],
): PrimitiveFacts {
  return Object.freeze({
    scanner: finding.scanner,
    ruleId: finding.ruleId,
    ruleVersion: finding.ruleVersion,
    severity: finding.severity,
    confidence: finding.confidence,
    validation: finding.validation,
    path: finding.location.path,
    line: finding.location.line,
  });
}

export function normalizeHostedPhase3Observations(
  input: Phase3ObservationAdapterInput,
): readonly Observation[] {
  if (!input.assetNodeId.trim() || !input.authorizationSnapshotRef.trim()) {
    throw new Error("PHASE3_OBSERVATION_BINDING_REQUIRED");
  }

  const byId = new Map<string, Observation>();
  const findings = [...input.envelope.findings].sort((a, b) =>
    a.fingerprint.localeCompare(b.fingerprint)
    || a.scanner.localeCompare(b.scanner)
    || a.ruleId.localeCompare(b.ruleId),
  );

  for (const finding of findings) {
    const evidenceRefs = uniqueSorted(input.evidenceRefsByFingerprint[finding.fingerprint] ?? []);
    if (evidenceRefs.length === 0) {
      throw new Error(`PHASE3_EVIDENCE_REFERENCE_REQUIRED:${finding.fingerprint}`);
    }

    const observationId = stableObservationId(input.envelope.runRef, finding.fingerprint);
    const observation: Observation = Object.freeze({
      observationId,
      runId: input.envelope.runRef,
      providerId: "scopeforge.phase3",
      providerVersion: input.envelope.tool.version,
      capabilityId: "source.security.finding.observe.v1",
      assetNodeIds: Object.freeze([input.assetNodeId]),
      evidenceRefs,
      facts: factsForFinding(finding),
      observedAt: input.envelope.scan.startedAt,
      confidence: CONFIDENCE[finding.confidence],
      authorizationSnapshotRef: input.authorizationSnapshotRef,
      executionMode: "passive",
    });

    const existing = byId.get(observationId);
    if (existing && JSON.stringify(existing) !== JSON.stringify(observation)) {
      throw new Error(`PHASE3_OBSERVATION_IDENTITY_CONFLICT:${finding.fingerprint}`);
    }
    byId.set(observationId, observation);
  }

  return Object.freeze([...byId.values()]);
}
