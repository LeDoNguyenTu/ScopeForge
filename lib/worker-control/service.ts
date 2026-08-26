import { createHash, randomBytes as nodeRandomBytes } from "node:crypto";
import {
  validateWorkerTerminalEnvelope,
  type WorkerTerminalEnvelope,
} from "@/packages/worker-contracts";
import type {
  FoundationProbeEnqueueInput,
  WorkerAuthenticationInput,
  WorkerClaimInput,
  WorkerLeaseIdentity,
  WorkerNodeIdentity,
} from "./types";
import type { WorkerControlRepository } from "./repository";

export type { WorkerControlRepository } from "./repository";

export interface WorkerControlServiceDependencies {
  repository: WorkerControlRepository;
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

export async function registerWorkerNode(
  input: { softwareVersion: string },
  dependencies: WorkerControlServiceDependencies,
) {
  const secret = randomSecret(dependencies);
  const node = await dependencies.repository.register({
    credentialHash: sha256(secret),
    softwareVersion: input.softwareVersion,
  });
  return Object.freeze({ ...node, secret });
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

export async function claimWorkerTask(
  input: WorkerClaimInput,
  dependencies: WorkerControlServiceDependencies,
) {
  return dependencies.repository.claim({ workerId: input.workerId });
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
  executionClass: "foundation_no_egress_v1";
} {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Worker terminal envelope must be an object.");
  }
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.taskId !== "string" || typeof candidate.attemptId !== "string") {
    throw new Error("Worker terminal envelope is missing task binding.");
  }
  return {
    taskId: candidate.taskId,
    attemptId: candidate.attemptId,
    executionClass: "foundation_no_egress_v1",
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

  return dependencies.repository.finalize({
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
  });
}

export async function recoverExpiredWorkerAttempts(
  dependencies: WorkerControlServiceDependencies,
): Promise<number> {
  return dependencies.repository.recover(currentTime(dependencies).toISOString());
}
