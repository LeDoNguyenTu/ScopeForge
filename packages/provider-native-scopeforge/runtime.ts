import type { RuntimeObservation } from "../runtime-observer";
import type { CorsPolicyObservation } from "../runtime-validator";
import type { Observation, PrimitiveFact, PrimitiveFacts } from "../security-planning";

export interface PassiveRuntimeObservationEntry {
  sequence: number;
  evidenceRefs: readonly string[];
  observation: RuntimeObservation;
}

export interface PassiveRuntimeObservationAdapterInput {
  runId: string;
  assetNodeId: string;
  authorizationSnapshotRef: string;
  observedAt: string;
  entries: readonly PassiveRuntimeObservationEntry[];
}

export interface ActiveCorsObservationAdapterInput {
  runId: string;
  assetNodeId: string;
  authorizationSnapshotRef: string;
  observedAt: string;
  evidenceRefs: readonly string[];
  observation: CorsPolicyObservation;
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values.map((value) => value.trim()).filter(Boolean))].sort());
}

function commonValidation(
  runId: string,
  assetNodeId: string,
  authorizationSnapshotRef: string,
  observedAt: string,
): void {
  if (!runId.trim() || !assetNodeId.trim() || !authorizationSnapshotRef.trim()) {
    throw new Error("RUNTIME_OBSERVATION_BINDING_REQUIRED");
  }
  if (!Number.isFinite(Date.parse(observedAt))) throw new Error("RUNTIME_OBSERVATION_TIMESTAMP_INVALID");
}

function compactFacts(input: Record<string, PrimitiveFact | null | undefined>): PrimitiveFacts {
  const entries = Object.entries(input).filter((entry): entry is [string, PrimitiveFact] =>
    entry[1] !== null && entry[1] !== undefined,
  );
  return Object.freeze(Object.fromEntries(entries));
}

function passiveFacts(observation: RuntimeObservation): PrimitiveFacts {
  switch (observation.kind) {
    case "http-status":
      return compactFacts({ kind: observation.kind, status: observation.status });
    case "redirect":
      return compactFacts({
        kind: observation.kind,
        toHost: observation.toHost,
        followed: observation.followed,
        reason: observation.reason,
      });
    case "header":
      return compactFacts({
        kind: observation.kind,
        name: observation.name,
        present: observation.present,
      });
    case "cookie":
      return compactFacts({
        kind: observation.kind,
        name: observation.name,
        secure: observation.secure,
        httpOnly: observation.httpOnly,
        sameSite: observation.sameSite,
      });
    case "tls":
      return compactFacts({
        kind: observation.kind,
        protocol: observation.protocol,
        validFrom: observation.validFrom,
        validTo: observation.validTo,
        sanCount: observation.sanCount,
        hostnameMatches: observation.hostnameMatches,
      });
  }
}

export function normalizePassiveRuntimeObservations(
  input: PassiveRuntimeObservationAdapterInput,
): readonly Observation[] {
  commonValidation(input.runId, input.assetNodeId, input.authorizationSnapshotRef, input.observedAt);

  const seenSequences = new Set<number>();
  const normalized = [...input.entries]
    .sort((a, b) => a.sequence - b.sequence)
    .map((entry): Observation => {
      if (!Number.isInteger(entry.sequence) || entry.sequence < 0 || seenSequences.has(entry.sequence)) {
        throw new Error("RUNTIME_OBSERVATION_SEQUENCE_INVALID");
      }
      seenSequences.add(entry.sequence);

      const evidenceRefs = uniqueSorted(entry.evidenceRefs);
      if (evidenceRefs.length === 0) throw new Error("RUNTIME_EVIDENCE_REFERENCE_REQUIRED");

      return Object.freeze({
        observationId: [
          "phase11",
          "runtime-observer",
          encodeURIComponent(input.runId),
          encodeURIComponent(input.assetNodeId),
          String(entry.sequence),
          entry.observation.kind,
        ].join(":"),
        runId: input.runId,
        providerId: "scopeforge.runtime-observer",
        providerVersion: "0.1",
        capabilityId: "web.runtime.observe.v1",
        assetNodeIds: Object.freeze([input.assetNodeId]),
        evidenceRefs,
        facts: passiveFacts(entry.observation),
        observedAt: input.observedAt,
        confidence: 0.9,
        authorizationSnapshotRef: input.authorizationSnapshotRef,
        executionMode: "passive",
      });
    });

  return Object.freeze(normalized);
}

export function normalizeActiveCorsObservation(
  input: ActiveCorsObservationAdapterInput,
): Observation {
  commonValidation(input.runId, input.assetNodeId, input.authorizationSnapshotRef, input.observedAt);
  const evidenceRefs = uniqueSorted(input.evidenceRefs);
  if (evidenceRefs.length === 0) throw new Error("RUNTIME_EVIDENCE_REFERENCE_REQUIRED");

  return Object.freeze({
    observationId: [
      "phase11",
      "runtime-validator",
      encodeURIComponent(input.runId),
      encodeURIComponent(input.assetNodeId),
      "cors-origin-policy@1",
    ].join(":"),
    runId: input.runId,
    providerId: "scopeforge.runtime-validator",
    providerVersion: "cors-origin-policy@1",
    capabilityId: "web.cors.validate.v1",
    assetNodeIds: Object.freeze([input.assetNodeId]),
    evidenceRefs,
    facts: compactFacts({
      kind: input.observation.kind,
      status: input.observation.status,
      allowedOrigin: input.observation.allowedOrigin,
      credentialsAllowed: input.observation.credentialsAllowed,
      variesOnOrigin: input.observation.variesOnOrigin,
    }),
    observedAt: input.observedAt,
    confidence: 0.95,
    authorizationSnapshotRef: input.authorizationSnapshotRef,
    executionMode: "validation",
  });
}
