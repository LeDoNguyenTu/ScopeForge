import { createHash } from "node:crypto";
import { deriveHostedPhase3PersistenceRows } from "@/lib/phase3-results/normalization";
import type { WorkerTerminalEnvelope } from "@/packages/worker-contracts";
import {
  validateRepositoryScanSuccess,
  type RepositoryScanSuccessExpectation,
} from "./result-validation";
import type {
  RepositoryScanPublicationResult,
  RepositoryScanSuccessPersistenceInput,
} from "./types";

export interface RepositoryScanPublicationRepository {
  publishSuccess(input: RepositoryScanSuccessPersistenceInput): Promise<RepositoryScanPublicationResult>;
}

export interface PublishRepositoryScanSuccessInput {
  workerId: string;
  taskId: string;
  attemptId: string;
  leaseToken: string;
  terminal: unknown;
  claimedSnapshot: Omit<RepositoryScanSuccessExpectation, "taskId" | "attemptId"> & {
    assetId: string;
  };
}

export interface RepositoryScanPublicationDependencies {
  repository: RepositoryScanPublicationRepository;
}

function sha256Json(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

export async function publishRepositoryScanSuccess(
  input: PublishRepositoryScanSuccessInput,
  dependencies: RepositoryScanPublicationDependencies,
): Promise<RepositoryScanPublicationResult> {
  const { assetId, ...snapshotExpectation } = input.claimedSnapshot;
  const validated = validateRepositoryScanSuccess(input.terminal, {
    taskId: input.taskId,
    attemptId: input.attemptId,
    ...snapshotExpectation,
  });
  const terminal = validated.terminal as WorkerTerminalEnvelope & {
    result: NonNullable<WorkerTerminalEnvelope["result"]> & { kind: "phase3_repository_scan" };
  };
  const envelope = validated.envelope;
  const rows = deriveHostedPhase3PersistenceRows(assetId, envelope);

  return dependencies.repository.publishSuccess({
    workerId: input.workerId,
    taskId: input.taskId,
    attemptId: input.attemptId,
    leaseToken: input.leaseToken,
    snapshotId: input.claimedSnapshot.snapshotId,
    repositoryCanonicalUrl: input.claimedSnapshot.canonicalRepositoryUrl,
    resolvedCommitSha: input.claimedSnapshot.resolvedCommitSha,
    snapshotContentDigest: input.claimedSnapshot.contentDigest,
    snapshotArtifactDigest: input.claimedSnapshot.artifactDigest,
    scannerProfileId: input.claimedSnapshot.scannerProfileId,
    scannerProfileVersion: input.claimedSnapshot.scannerProfileVersion,
    terminalPayloadDigest: sha256Json(terminal),
    resultDigest: terminal.result.resultDigest,
    runRef: envelope.runRef,
    toolVersion: envelope.tool.version,
    scanStartedAt: envelope.scan.startedAt,
    scanDurationMs: envelope.scan.durationMs,
    scannerDescriptors: [...envelope.scan.scanners],
    scannerErrorCount: envelope.scan.scannerErrorCount,
    filesAnalyzed: envelope.inventory.filesAnalyzed,
    filesSkipped: envelope.inventory.filesSkipped,
    totalBytes: envelope.inventory.totalBytes,
    wallTimeMs: terminal.metrics.wallTimeMs,
    cpuTimeMs: terminal.metrics.cpuTimeMs,
    peakMemoryBytes: terminal.metrics.peakMemoryBytes,
    inputBytes: terminal.metrics.inputBytes,
    outputBytes: terminal.metrics.outputBytes,
    findings: rows.findings,
    evidence: rows.evidence,
  });
}
