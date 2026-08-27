import { createHash, randomBytes as nodeRandomBytes } from "node:crypto";
import type { RepositorySnapshotObjectStore } from "@/lib/repository-snapshots/object-store";
import {
  validateWorkerTerminalEnvelope,
  type WorkerExecutionClass,
  type WorkerTerminalEnvelope,
} from "@/packages/worker-contracts";
import {
  WorkerControlError,
  type FoundationProbeEnqueueInput,
  type WorkerAuthenticationInput,
  type WorkerClaimInput,
  type WorkerClaimResult,
  type WorkerLeaseIdentity,
  type WorkerNodeIdentity,
  type WorkerPersistenceClaimResult,
} from "./types";
import type { WorkerControlRepository } from "./repository";

export type { WorkerControlRepository } from "./repository";

export interface WorkerControlServiceDependencies {
  repository: WorkerControlRepository;
  repositorySnapshotObjectStore?: () => RepositorySnapshotObjectStore;
  randomBytes?: (size: number) => Buffer;
  now?: () => Date;
}

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

async function registerWith(
  softwareVersion: string,
  dependencies: WorkerControlServiceDependencies,
  executionClass: WorkerExecutionClass,
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
      : await dependencies.repository.registerRepositoryScan(input);
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

export async function registerRepositoryScanWorkerNode(
  input: { softwareVersion: string },
  dependencies: WorkerControlServiceDependencies,
) {
  return registerWith(input.softwareVersion, dependencies, "phase3_repository_scan_no_egress_v1");
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

async function composePublicClaim(
  claim: WorkerPersistenceClaimResult,
  dependencies: WorkerControlServiceDependencies,
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

export async function claimWorkerTask(
  input: WorkerClaimInput,
  dependencies: WorkerControlServiceDependencies,
): Promise<WorkerClaimResult> {
  const claim = await dependencies.repository.claim({ workerId: input.workerId });
  return composePublicClaim(claim, dependencies);
}

export async function claimWorkerTaskForNode(
  worker: WorkerNodeIdentity,
  dependencies: WorkerControlServiceDependencies,
): Promise<WorkerClaimResult> {
  const claim = worker.executionClass === "phase3_repository_scan_no_egress_v1"
    ? await dependencies.repository.claimRepositoryScan({ workerId: worker.workerId })
    : await dependencies.repository.claim({ workerId: worker.workerId });
  if (claim !== null && claim.executionClass !== worker.executionClass) {
    throw new WorkerControlError("WORKER_CONTROL_FAILED");
  }
  return composePublicClaim(claim, dependencies);
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

function terminalDigest(terminal: WorkerTerminalEnvelope): string {
  return sha256(JSON.stringify(terminal));
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

export async function recoverExpiredWorkerAttempts(
  dependencies: WorkerControlServiceDependencies,
): Promise<number> {
  return dependencies.repository.recover(currentTime(dependencies).toISOString());
}