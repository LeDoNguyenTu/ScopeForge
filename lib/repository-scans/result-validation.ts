import { createHash } from "node:crypto";
import { validateHostedPhase3Envelope } from "@/lib/phase3-import/validation";
import {
  HOSTED_PHASE3_SCANNER_DESCRIPTORS,
  HOSTED_PHASE3_SCANNER_PROFILE_ID,
  HOSTED_PHASE3_SCANNER_PROFILE_VERSION,
  HOSTED_PHASE3_TOOL_VERSION,
} from "@/packages/hosted-scanner-runner/profile";
import {
  validateWorkerTerminalEnvelope,
  type WorkerTerminalEnvelope,
} from "@/packages/worker-contracts";
import type { HostedPhase3EnvelopeV1 } from "@/packages/scanner-output/hosted/types";
import { RepositoryScanError } from "./types";

export interface RepositoryScanSuccessExpectation {
  taskId: string;
  attemptId: string;
  snapshotId: string;
  canonicalRepositoryUrl: string;
  resolvedCommitSha: string;
  contentDigest: string;
  scannerProfileId: typeof HOSTED_PHASE3_SCANNER_PROFILE_ID;
  scannerProfileVersion: typeof HOSTED_PHASE3_SCANNER_PROFILE_VERSION;
  retainedFileCount: number;
  retainedBytes: number;
}

export interface ValidatedRepositoryScanSuccess {
  terminal: WorkerTerminalEnvelope & {
    executionClass: "phase3_repository_scan_no_egress_v1";
    outcome: "succeeded";
    result: NonNullable<WorkerTerminalEnvelope["result"]> & {
      kind: "phase3_repository_scan";
    };
  };
  envelope: HostedPhase3EnvelopeV1;
}

function invalid(): never {
  throw new RepositoryScanError("REPOSITORY_SCAN_OUTPUT_INVALID");
}

function exactScannerDescriptors(value: readonly string[]): boolean {
  return value.length === HOSTED_PHASE3_SCANNER_DESCRIPTORS.length
    && value.every((descriptor, index) => descriptor === HOSTED_PHASE3_SCANNER_DESCRIPTORS[index]);
}

function boundedSnapshotCount(value: number, maximum: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= maximum;
}

export function validateRepositoryScanSuccess(
  value: unknown,
  expected: RepositoryScanSuccessExpectation,
): ValidatedRepositoryScanSuccess {
  let terminal: WorkerTerminalEnvelope;
  try {
    terminal = validateWorkerTerminalEnvelope(value, {
      taskId: expected.taskId,
      attemptId: expected.attemptId,
      executionClass: "phase3_repository_scan_no_egress_v1",
    });
  } catch {
    return invalid();
  }

  if (terminal.outcome !== "succeeded" || terminal.result?.kind !== "phase3_repository_scan") {
    return invalid();
  }
  const result = terminal.result;
  if (
    result.snapshotId !== expected.snapshotId
    || result.canonicalRepositoryUrl !== expected.canonicalRepositoryUrl
    || result.resolvedCommitSha !== expected.resolvedCommitSha
    || result.contentDigest !== expected.contentDigest
    || result.scannerProfileId !== expected.scannerProfileId
    || result.scannerProfileVersion !== expected.scannerProfileVersion
    || result.scannerProfileId !== HOSTED_PHASE3_SCANNER_PROFILE_ID
    || result.scannerProfileVersion !== HOSTED_PHASE3_SCANNER_PROFILE_VERSION
  ) {
    return invalid();
  }

  const canonicalHostedBytes = JSON.stringify(result.hostedResult);
  const computedResultDigest = createHash("sha256")
    .update(canonicalHostedBytes, "utf8")
    .digest("hex");
  if (computedResultDigest !== result.resultDigest) return invalid();

  let envelope: HostedPhase3EnvelopeV1;
  try {
    envelope = validateHostedPhase3Envelope(result.hostedResult);
  } catch {
    return invalid();
  }

  if (
    envelope.repository.canonicalUrl !== expected.canonicalRepositoryUrl
    || envelope.tool.name !== "ScopeForge"
    || envelope.tool.version !== HOSTED_PHASE3_TOOL_VERSION
    || envelope.scan.scannerErrorCount !== 0
    || !exactScannerDescriptors(envelope.scan.scanners)
    || !boundedSnapshotCount(envelope.inventory.filesAnalyzed, expected.retainedFileCount)
    || !boundedSnapshotCount(envelope.inventory.filesSkipped, expected.retainedFileCount)
    || envelope.inventory.filesAnalyzed + envelope.inventory.filesSkipped > expected.retainedFileCount
    || !boundedSnapshotCount(envelope.inventory.totalBytes, expected.retainedBytes)
  ) {
    return invalid();
  }

  return Object.freeze({
    terminal: terminal as ValidatedRepositoryScanSuccess["terminal"],
    envelope,
  });
}
