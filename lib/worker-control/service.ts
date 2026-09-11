import { createHash, randomBytes as nodeRandomBytes } from "node:crypto";
import type { RepositorySnapshotObjectStore } from "@/lib/repository-snapshots/object-store";
import {
  validateWorkerTerminalEnvelope,
  workerExecutionProfile,
  type GitHubPrivateArchiveLease,
  type WorkerAttemptMetrics,
  type WorkerExecutionClass,
  type WorkerTerminalEnvelope,
  type WorkerTerminalFailureCode,
} from "@/packages/worker-contracts";
import {
  WorkerControlError,
  type FoundationProbeEnqueueInput,
  type RuntimeWorkerEnqueueInput,
  type RuntimeWorkerPersistenceClaimResult,
  type WorkerAuthenticationInput,
  type WorkerClaimInput,
  type WorkerClaimResult,
  type WorkerLeaseIdentity,
  type WorkerNodeIdentity,
  type WorkerPersistenceClaimResult,
} from "./types";
import type {
  RuntimeWorkerControlRepository,
  WorkerControlRepository,
} from "./repository";

export type {
  RuntimeWorkerControlRepository,
  WorkerControlRepository,
} from "./repository";

export interface PrivateRepositorySourceLeaseRequest {
  githubRepositoryLinkId: string;
  owner: string;
  repository: string;
  canonicalRepositoryUrl: string;
  absoluteDeadlineAt: string;
  leaseExpiresAt: string;
}

export interface WorkerControlServiceDependencies {
  repository: WorkerControlRepository;
  runtimeRepository?: RuntimeWorkerControlRepository;
  repositorySnapshotObjectStore?: () => RepositorySnapshotObjectStore;
  privateRepositorySourceLease?: (
    input: PrivateRepositorySourceLeaseRequest,
  ) => Promise<GitHubPrivateArchiveLease>;
  randomBytes?: (size: number) => Buffer;
  now?: () => Date;
}

type LegacyRegistrationClass =
  | "foundation_no_egress_v1"
  | "repository_snapshot_github_public_v1"
  | "repository_snapshot_github_private_v1"
  | "phase3_repository_scan_no_egress_v1";

type RuntimeRegistrationClass =
  | "passive_runtime_observation_v1"
  | "active_cors_validation_v1";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRIVATE_REPOSITORY_FAILURE_CODES = new Set<WorkerTerminalFailureCode>([
  "WORKER_LOST",
  "WORKER_BUDGET_EXCEEDED",
  "WORKER_OUTPUT_INVALID",
  "WORKER_EXECUTION_FAILED",
  "WORKER_CLASS_UNAVAILABLE",
  "REPOSITORY_UNAVAILABLE",
  "REPOSITORY_IDENTITY_CHANGED",
  "REPOSITORY_NETWORK_POLICY_FAILED",
  "REPOSITORY_ARCHIVE_UNSAFE",
  "REPOSITORY_ARCHIVE_BUDGET_EXCEEDED",
  "REPOSITORY_ARTIFACT_UPLOAD_FAILED",
]);

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function randomSecret(dependencies: WorkerControlServiceDependencies): string {
  const generator = dependencies.randomBytes ?? nodeRandomBytes;
  const bytes = generator(32);
  if (!Buffer.isBuffer(bytes) || bytes.length !== 32) {
    throw new Error("Worker secret generator must return exactly 32 bytes.");
  }
  return bytes.toString("hex");
}

function currentTime(dependencies: WorkerControlServiceDependencies): Date {
  return (dependencies.now ?? (() => new Date()))();
}

function requireRuntimeRepository(
  dependencies: WorkerControlServiceDependencies,
): RuntimeWorkerControlRepository {
  if (!dependencies.runtimeRepository) {
    throw new WorkerControlError("WORKER_CONTROL_FAILED");
  }
  return dependencies.runtimeRepository;
}

async function registerWith(
  softwareVersion: string,
  dependencies: WorkerControlServiceDependencies,
  executionClass: LegacyRegistrationClass,
) {
  const secret = randomSecret(dependencies);
  const input = {
    credentialHash: sha256(secret),
    softwareVersion,
  };
  const node = executionClass === "foundation_no_egress_v1"
    ? await dependencies.repository.register(input)
    : executionClass === "repository_snapshot_github_public_v1"
      ? await dependencies.repository.registerRepositorySnapshot(input)
      : executionClass === "repository_snapshot_github_private_v1"
        ? await dependencies.repository.registerPrivateRepositorySnapshot(input)
        : await dependencies.repository.registerRepositoryScan(input);
  if (node.executionClass !== executionClass) {
    throw new WorkerControlError("WORKER_CONTROL_FAILED");
  }
  return Object.freeze({ ...node, secret });
}

async function registerRuntimeWith(
  softwareVersion: string,
  dependencies: WorkerControlServiceDependencies,
  executionClass: RuntimeRegistrationClass,
) {
  const secret = randomSecret(dependencies);
  const input = {
    credentialHash: sha256(secret),
    softwareVersion,
  };
  const repository = requireRuntimeRepository(dependencies);
  const node = executionClass === "passive_runtime_observation_v1"
    ? await repository.registerPassiveRuntime(input)
    : await repository.registerActiveCors(input);
  if (node.executionClass !== executionClass) {
    throw new WorkerControlError("WORKER_CONTROL_FAILED");
  }
  return Object.freeze({ ...node, secret });
}

export async function registerWorkerNode(
  input: { softwareVersion: string },
  dependencies: WorkerControlServiceDependencies,
) {
  return registerWith(input.softwareVersion, dependencies, "foundation_no_egress_v1");
}

export async function registerRepositorySnapshotWorkerNode(
  input: { softwareVersion: string },
  dependencies: WorkerControlServiceDependencies,
) {
  return registerWith(input.softwareVersion, dependencies, "repository_snapshot_github_public_v1");
}

export async function registerPrivateRepositorySnapshotWorkerNode(
  input: { softwareVersion: string },
  dependencies: WorkerControlServiceDependencies,
) {
  return registerWith(input.softwareVersion, dependencies, "repository_snapshot_github_private_v1");
}

export async function registerRepositoryScanWorkerNode(
  input: { softwareVersion: string },
  dependencies: WorkerControlServiceDependencies,
) {
  return registerWith(input.softwareVersion, dependencies, "phase3_repository_scan_no_egress_v1");
}

export async function registerPassiveRuntimeWorkerNode(
  input: { softwareVersion: string },
  dependencies: WorkerControlServiceDependencies,
) {
  return registerRuntimeWith(input.softwareVersion, dependencies, "passive_runtime_observation_v1");
}

export async function registerActiveCorsWorkerNode(
  input: { softwareVersion: string },
  dependencies: WorkerControlServiceDependencies,
) {
  return registerRuntimeWith(input.softwareVersion, dependencies, "active_cors_validation_v1");
}

export async function disableWorkerNode(
  workerId: string,
  dependencies: WorkerControlServiceDependencies,
) {
  return dependencies.repository.disable(workerId);
}

export async function authenticateWorkerNode(
  input: { workerId: string; secret: string },
  dependencies: WorkerControlServiceDependencies,
): Promise<WorkerNodeIdentity> {
  if (!/^[a-f0-9]{64}$/.test(input.secret)) {
    throw new Error("Worker credential is malformed.");
  }
  const repositoryInput: WorkerAuthenticationInput = {
    workerId: input.workerId,
    credentialHash: sha256(input.secret),
  };
  return dependencies.repository.authenticate(repositoryInput);
}

export async function enqueueFoundationWorkerProbe(
  input: FoundationProbeEnqueueInput,
  dependencies: WorkerControlServiceDependencies,
) {
  return dependencies.repository.enqueueFoundationProbe(input);
}

export async function enqueuePassiveRuntimeWorkerTask(
  input: RuntimeWorkerEnqueueInput,
  dependencies: WorkerControlServiceDependencies,
) {
  return requireRuntimeRepository(dependencies).enqueuePassiveRuntime(input);
}

export async function enqueueActiveCorsWorkerTask(
  input: RuntimeWorkerEnqueueInput,
  dependencies: WorkerControlServiceDependencies,
) {
  return requireRuntimeRepository(dependencies).enqueueActiveCors(input);
}

function repositoryClaimExpiry(
  claim: Exclude<WorkerPersistenceClaimResult, null>,
  now: Date,
): Date {
  const deadline = new Date(claim.absoluteDeadlineAt);
  if (!Number.isFinite(deadline.getTime()) || !Number.isFinite(now.getTime())) {
    throw new WorkerControlError("WORKER_CONTROL_FAILED");
  }
  const expiresAt = new Date(Math.min(deadline.getTime(), now.getTime() + 360_000));
  if (expiresAt.getTime() - now.getTime() < 1_000) {
    throw new WorkerControlError("WORKER_CONTROL_FAILED");
  }
  return expiresAt;
}

function boundedPrivateCapabilityExpiry(
  claim: Exclude<WorkerPersistenceClaimResult, null>,
  sourceLease: GitHubPrivateArchiveLease,
  now: Date,
): Date {
  const publicBound = repositoryClaimExpiry(claim, now);
  const sourceExpiry = new Date(sourceLease.expiresAt);
  if (!Number.isFinite(sourceExpiry.getTime())) {
    throw new WorkerControlError("WORKER_CONTROL_FAILED");
  }
  const expiresAt = new Date(Math.min(publicBound.getTime(), sourceExpiry.getTime()));
  if (expiresAt.getTime() - now.getTime() < 1_000) {
    throw new WorkerControlError("WORKER_CONTROL_FAILED");
  }
  return expiresAt;
}

async function composeClaim(
  claim: WorkerPersistenceClaimResult,
  dependencies: WorkerControlServiceDependencies,
  workerId?: string,
): Promise<WorkerClaimResult> {
  if (claim === null) return null;
  if (claim.executionClass === "foundation_no_egress_v1"
      || claim.executionClass === "phase3_repository_scan_no_egress_v1") {
    return Object.freeze({
      taskId: claim.taskId,
      attemptId: claim.attemptId,
      executionClass: claim.executionClass,
      leaseToken: claim.leaseToken,
      absoluteDeadlineAt: claim.absoluteDeadlineAt,
      budget: claim.budget,
      input: claim.input,
    });
  }

  const objectStoreFactory = dependencies.repositorySnapshotObjectStore;
  if (!objectStoreFactory) throw new WorkerControlError("WORKER_CONTROL_FAILED");

  if (claim.executionClass === "repository_snapshot_github_private_v1") {
    if (!workerId || !dependencies.privateRepositorySourceLease) {
      throw new WorkerControlError("WORKER_CONTROL_FAILED");
    }
    const heartbeat = await dependencies.repository.heartbeat({
      workerId,
      taskId: claim.taskId,
      attemptId: claim.attemptId,
      leaseToken: claim.leaseToken,
    });
    if (heartbeat.cancelRequested) {
      throw new WorkerControlError("WORKER_JOB_STATE_CONFLICT");
    }
    const privateArchiveLease = await dependencies.privateRepositorySourceLease({
      githubRepositoryLinkId: claim.input.githubRepositoryLinkId,
      owner: claim.input.owner,
      repository: claim.input.repository,
      canonicalRepositoryUrl: claim.input.canonicalRepositoryUrl,
      absoluteDeadlineAt: claim.absoluteDeadlineAt,
      leaseExpiresAt: heartbeat.leaseExpiresAt,
    });
    const now = currentTime(dependencies);
    const upload = await objectStoreFactory().createAttemptUpload({
      objectKey: claim.artifactObjectKey,
      expiresAt: boundedPrivateCapabilityExpiry(claim, privateArchiveLease, now),
    });
    return Object.freeze({
      taskId: claim.taskId,
      attemptId: claim.attemptId,
      executionClass: claim.executionClass,
      leaseToken: claim.leaseToken,
      absoluteDeadlineAt: claim.absoluteDeadlineAt,
      budget: claim.budget,
      input: Object.freeze({
        kind: "repository_snapshot_github_private" as const,
        owner: claim.input.owner,
        repository: claim.input.repository,
        canonicalRepositoryUrl: claim.input.canonicalRepositoryUrl,
        privateArchiveLease,
        artifactUpload: upload,
      }),
    });
  }

  const upload = await objectStoreFactory().createAttemptUpload({
    objectKey: claim.artifactObjectKey,
    expiresAt: repositoryClaimExpiry(claim, currentTime(dependencies)),
  });
  return Object.freeze({
    taskId: claim.taskId,
    attemptId: claim.attemptId,
    executionClass: claim.executionClass,
    leaseToken: claim.leaseToken,
    absoluteDeadlineAt: claim.absoluteDeadlineAt,
    budget: claim.budget,
    input: Object.freeze({
      ...claim.input,
      artifactUpload: upload,
    }),
  });
}

function composeRuntimeClaim(
  claim: RuntimeWorkerPersistenceClaimResult,
): WorkerClaimResult {
  if (claim === null) return null;
  return Object.freeze({
    taskId: claim.taskId,
    attemptId: claim.attemptId,
    executionClass: claim.executionClass,
    leaseToken: claim.leaseToken,
    absoluteDeadlineAt: claim.absoluteDeadlineAt,
    budget: claim.budget,
    input: claim.input,
  });
}

export async function claimWorkerTask(
  input: WorkerClaimInput,
  dependencies: WorkerControlServiceDependencies,
): Promise<WorkerClaimResult> {
  const claim = await dependencies.repository.claim({ workerId: input.workerId });
  return composeClaim(claim, dependencies, input.workerId);
}

export async function claimWorkerTaskForNode(
  worker: WorkerNodeIdentity,
  dependencies: WorkerControlServiceDependencies,
): Promise<WorkerClaimResult> {
  if (
    worker.executionClass === "passive_runtime_observation_v1"
    || worker.executionClass === "active_cors_validation_v1"
  ) {
    const runtimeClaim = await requireRuntimeRepository(dependencies).claimRuntime({ workerId: worker.workerId });
    if (runtimeClaim !== null && runtimeClaim.executionClass !== worker.executionClass) {
      throw new WorkerControlError("WORKER_CONTROL_FAILED");
    }
    return composeRuntimeClaim(runtimeClaim);
  }

  const claim = worker.executionClass === "phase3_repository_scan_no_egress_v1"
    ? await dependencies.repository.claimRepositoryScan({ workerId: worker.workerId })
    : await dependencies.repository.claim({ workerId: worker.workerId });
  if (claim !== null && claim.executionClass !== worker.executionClass) {
    throw new WorkerControlError("WORKER_CONTROL_FAILED");
  }
  return composeClaim(claim, dependencies, worker.workerId);
}

export async function heartbeatWorkerAttempt(
  input: WorkerLeaseIdentity,
  dependencies: WorkerControlServiceDependencies,
) {
  return dependencies.repository.heartbeat(input);
}

function terminalExpectation(value: unknown): {
  taskId: string;
  attemptId: string;
  executionClass: WorkerExecutionClass;
} {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Worker terminal envelope must be an object.");
  }
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.taskId !== "string" || typeof candidate.attemptId !== "string") {
    throw new Error("Worker terminal envelope is missing task binding.");
  }
  if (
    candidate.executionClass !== "foundation_no_egress_v1"
    && candidate.executionClass !== "repository_snapshot_github_public_v1"
    && candidate.executionClass !== "phase3_repository_scan_no_egress_v1"
  ) {
    throw new Error("Worker terminal execution class is unsupported.");
  }
  return {
    taskId: candidate.taskId,
    attemptId: candidate.attemptId,
    executionClass: candidate.executionClass,
  };
}

function terminalDigest(terminal: unknown): string {
  return sha256(JSON.stringify(terminal));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function boundedMetric(value: unknown, maximum: number): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > maximum) {
    throw new WorkerControlError("WORKER_TERMINAL_INVALID");
  }
  return value as number;
}

function validatePrivateFailureMetrics(value: unknown): WorkerAttemptMetrics {
  if (!isRecord(value) || !exactKeys(value, [
    "wallTimeMs",
    "cpuTimeMs",
    "peakMemoryBytes",
    "inputBytes",
    "outputBytes",
  ])) {
    throw new WorkerControlError("WORKER_TERMINAL_INVALID");
  }
  const budget = workerExecutionProfile("repository_snapshot_github_private_v1").budget;
  return Object.freeze({
    wallTimeMs: boundedMetric(value.wallTimeMs, budget.maxWallTimeMs),
    cpuTimeMs: boundedMetric(value.cpuTimeMs, budget.maxCpuTimeMs),
    peakMemoryBytes: boundedMetric(value.peakMemoryBytes, budget.maxMemoryBytes),
    inputBytes: boundedMetric(value.inputBytes, budget.maxInputBytes),
    outputBytes: boundedMetric(value.outputBytes, budget.maxOutputBytes),
  });
}

function validatePrivateRepositoryFailureTerminal(value: unknown) {
  if (!isRecord(value) || !exactKeys(value, [
    "schemaVersion",
    "taskId",
    "attemptId",
    "executionClass",
    "outcome",
    "failureCode",
    "metrics",
    "result",
  ])) {
    throw new WorkerControlError("WORKER_TERMINAL_INVALID");
  }
  if (
    value.schemaVersion !== 1
    || typeof value.taskId !== "string"
    || !UUID_PATTERN.test(value.taskId)
    || typeof value.attemptId !== "string"
    || !UUID_PATTERN.test(value.attemptId)
    || value.executionClass !== "repository_snapshot_github_private_v1"
  ) {
    throw new WorkerControlError("WORKER_TERMINAL_INVALID");
  }
  if (value.outcome === "succeeded") {
    throw new WorkerControlError("REPOSITORY_SNAPSHOT_PUBLICATION_REQUIRED");
  }
  if (value.outcome !== "failed" && value.outcome !== "cancelled") {
    throw new WorkerControlError("WORKER_TERMINAL_INVALID");
  }
  if (value.result !== null) {
    throw new WorkerControlError("WORKER_TERMINAL_INVALID");
  }
  let failureCode: WorkerTerminalFailureCode | null;
  if (value.outcome === "cancelled") {
    if (value.failureCode !== null) throw new WorkerControlError("WORKER_TERMINAL_INVALID");
    failureCode = null;
  } else {
    if (
      typeof value.failureCode !== "string"
      || !PRIVATE_REPOSITORY_FAILURE_CODES.has(value.failureCode as WorkerTerminalFailureCode)
    ) {
      throw new WorkerControlError("WORKER_TERMINAL_INVALID");
    }
    failureCode = value.failureCode as WorkerTerminalFailureCode;
  }
  return Object.freeze({
    taskId: value.taskId,
    attemptId: value.attemptId,
    outcome: value.outcome,
    failureCode,
    metrics: validatePrivateFailureMetrics(value.metrics),
  });
}

export async function finalizeWorkerAttempt(
  input: {
    workerId: string;
    leaseToken: string;
    terminal: unknown;
  },
  dependencies: WorkerControlServiceDependencies,
) {
  if (!/^[a-f0-9]{64}$/.test(input.leaseToken)) {
    throw new Error("Worker lease token is malformed.");
  }
  const expected = terminalExpectation(input.terminal);
  const terminal = validateWorkerTerminalEnvelope(input.terminal, expected);
  if (
    terminal.executionClass === "repository_snapshot_github_public_v1"
    && terminal.outcome === "succeeded"
  ) {
    throw new WorkerControlError("REPOSITORY_SNAPSHOT_PUBLICATION_REQUIRED");
  }
  if (
    terminal.executionClass === "phase3_repository_scan_no_egress_v1"
    && terminal.outcome === "succeeded"
  ) {
    throw new WorkerControlError("REPOSITORY_SCAN_PUBLICATION_REQUIRED");
  }

  const persistenceInput = {
    workerId: input.workerId,
    taskId: terminal.taskId,
    attemptId: terminal.attemptId,
    leaseToken: input.leaseToken,
    terminalOutcome: terminal.outcome,
    failureCode: terminal.failureCode,
    terminalPayloadDigest: terminalDigest(terminal),
    wallTimeMs: terminal.metrics.wallTimeMs,
    cpuTimeMs: terminal.metrics.cpuTimeMs,
    peakMemoryBytes: terminal.metrics.peakMemoryBytes,
    inputBytes: terminal.metrics.inputBytes,
    outputBytes: terminal.metrics.outputBytes,
  };

  return terminal.executionClass === "phase3_repository_scan_no_egress_v1"
    ? dependencies.repository.finalizeRepositoryScanFailure(persistenceInput)
    : dependencies.repository.finalize(persistenceInput);
}

export async function finalizePrivateRepositorySnapshotFailureAttempt(
  input: {
    workerId: string;
    leaseToken: string;
    terminal: unknown;
  },
  dependencies: WorkerControlServiceDependencies,
) {
  if (!/^[a-f0-9]{64}$/.test(input.leaseToken)) {
    throw new Error("Worker lease token is malformed.");
  }
  const terminal = validatePrivateRepositoryFailureTerminal(input.terminal);
  return dependencies.repository.finalize({
    workerId: input.workerId,
    taskId: terminal.taskId,
    attemptId: terminal.attemptId,
    leaseToken: input.leaseToken,
    terminalOutcome: terminal.outcome,
    failureCode: terminal.failureCode,
    terminalPayloadDigest: terminalDigest(input.terminal),
    wallTimeMs: terminal.metrics.wallTimeMs,
    cpuTimeMs: terminal.metrics.cpuTimeMs,
    peakMemoryBytes: terminal.metrics.peakMemoryBytes,
    inputBytes: terminal.metrics.inputBytes,
    outputBytes: terminal.metrics.outputBytes,
  });
}

export async function recoverExpiredWorkerAttempts(
  dependencies: WorkerControlServiceDependencies,
): Promise<number> {
  return dependencies.repository.recover(currentTime(dependencies).toISOString());
}
