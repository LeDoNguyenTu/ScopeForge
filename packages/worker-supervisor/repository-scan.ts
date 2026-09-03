import { createHash } from "node:crypto";
import { lstat, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  validateWorkerTerminalEnvelope,
  type RepositoryScanInput,
  type WorkerTaskContract,
  type WorkerTerminalEnvelope,
  type WorkerTerminalFailureCode,
} from "@/packages/worker-contracts";
import {
  createPodmanSandbox,
  PodmanSandboxError,
  type PodmanSandbox,
} from "@/packages/worker-sandbox";
import { removeMaterializedRepositorySnapshot } from "@/packages/repository-snapshot";
import {
  stageRepositoryScanSnapshot,
  type RepositoryScanStagingArtifact,
} from "./repository-scan-stager";
import type {
  RepositoryScanPreparedInput,
  WorkerExecutor,
  WorkerExecutorContract,
} from "./executor";

export interface RepositoryScanPreparedContract extends WorkerExecutorContract {
  executionClass: "phase3_repository_scan_no_egress_v1";
  input: RepositoryScanPreparedInput;
}

export interface PreparedRepositoryScan {
  contract: RepositoryScanPreparedContract;
  cleanup(): Promise<void>;
}

export interface RepositoryScanPrepareInput {
  task: WorkerTaskContract;
  artifact: RepositoryScanStagingArtifact;
  signal: AbortSignal;
}

export interface RepositoryScanPreparer {
  prepare(input: RepositoryScanPrepareInput): Promise<PreparedRepositoryScan>;
}

export interface RepositoryScanPreparerDependencies {
  workRoot: string;
  expectedHost: string;
  fetch?: typeof fetch;
  stage?: typeof stageRepositoryScanSnapshot;
}

export interface RepositoryScanExecutorDependencies {
  podmanBinary: string;
  scannerImage: string;
  sandbox?: PodmanSandbox;
  now?: () => number;
}

function repositoryScanTask(task: WorkerTaskContract): RepositoryScanInput {
  if (task.executionClass !== "phase3_repository_scan_no_egress_v1"
      || task.input.kind !== "phase3_repository_scan") {
    throw new Error("Repository scan preparation requires the fixed Phase 6C task contract.");
  }
  return task.input;
}

function safeWorkRoot(value: string): string {
  if (!path.isAbsolute(value) || /[\r\n\u0000]/.test(value)) {
    throw new Error("Repository scan work root must be a safe absolute path.");
  }
  return path.normalize(value);
}

export function createRepositoryScanPreparer(
  dependencies: RepositoryScanPreparerDependencies,
): RepositoryScanPreparer {
  const workRoot = safeWorkRoot(dependencies.workRoot);
  const stage = dependencies.stage ?? stageRepositoryScanSnapshot;
  const preparer: RepositoryScanPreparer = {
    async prepare({ task, artifact, signal }) {
      const input = repositoryScanTask(task);
      if (artifact.snapshotId !== input.snapshotId
          || artifact.storedArtifactBytes !== input.storedArtifactBytes
          || artifact.artifactDigest !== input.artifactDigest) {
        throw new Error("Repository scan artifact does not match the claimed immutable snapshot.");
      }
      const rootMetadata = await lstat(workRoot);
      if (!rootMetadata.isDirectory()) throw new Error("Repository scan work root is not a directory.");
      const workDirectory = await mkdtemp(path.join(workRoot, "scopeforge-scan-"));

      try {
        const staged = await stage({
          workDirectory,
          artifact,
          snapshot: {
            snapshotId: input.snapshotId,
            canonicalRepositoryUrl: input.canonicalRepositoryUrl,
            resolvedCommitSha: input.resolvedCommitSha,
            contentDigest: input.contentDigest,
            artifactDigest: input.artifactDigest,
            storedArtifactBytes: input.storedArtifactBytes,
            retainedFileCount: input.retainedFileCount,
            retainedBytes: input.retainedBytes,
          },
          expectedHost: dependencies.expectedHost,
          signal,
        }, {
          ...(dependencies.fetch ? { fetch: dependencies.fetch } : {}),
        });

        const contract: RepositoryScanPreparedContract = Object.freeze({
          taskId: task.taskId,
          attemptId: task.attemptId,
          executionClass: "phase3_repository_scan_no_egress_v1",
          absoluteDeadlineAt: task.absoluteDeadlineAt,
          budget: task.budget,
          input: Object.freeze({
            kind: "phase3_repository_scan_prepared",
            sourceDirectory: staged.sourceDirectory,
            snapshotId: input.snapshotId,
            canonicalRepositoryUrl: input.canonicalRepositoryUrl,
            resolvedCommitSha: input.resolvedCommitSha,
            contentDigest: input.contentDigest,
            artifactDigest: input.artifactDigest,
            scannerProfileId: input.scannerProfileId,
            scannerProfileVersion: input.scannerProfileVersion,
            retainedBytes: input.retainedBytes,
          }),
        });

        return Object.freeze({
          contract,
          cleanup: async () => {
            await removeMaterializedRepositorySnapshot(staged.sourceDirectory);
            await rm(workDirectory, { recursive: true, force: true });
          },
        });
      } catch (error) {
        await removeMaterializedRepositorySnapshot(
          path.join(workDirectory, "materialized-source"),
        ).catch(() => undefined);
        await rm(workDirectory, { recursive: true, force: true }).catch(() => undefined);
        throw error;
      }
    },
  };
  return Object.freeze(preparer);
}

function failedTerminal(
  contract: RepositoryScanPreparedContract,
  failureCode: WorkerTerminalFailureCode,
  wallTimeMs: number,
): WorkerTerminalEnvelope {
  return Object.freeze({
    schemaVersion: 1,
    taskId: contract.taskId,
    attemptId: contract.attemptId,
    executionClass: contract.executionClass,
    outcome: "failed",
    failureCode,
    metrics: Object.freeze({
      wallTimeMs: Math.min(contract.budget.maxWallTimeMs, Math.max(0, Math.trunc(wallTimeMs))),
      cpuTimeMs: 0,
      peakMemoryBytes: 0,
      inputBytes: contract.input.retainedBytes,
      outputBytes: 0,
    }),
    result: null,
  });
}

function preparedContract(value: WorkerExecutorContract): RepositoryScanPreparedContract {
  if (value.executionClass !== "phase3_repository_scan_no_egress_v1"
      || value.input.kind !== "phase3_repository_scan_prepared") {
    throw new Error("Repository scan executor received an unprepared contract.");
  }
  if (!path.isAbsolute(value.input.sourceDirectory)
      || path.basename(value.input.sourceDirectory) !== "materialized-source") {
    throw new Error("Repository scan executor source directory is invalid.");
  }
  return value as RepositoryScanPreparedContract;
}

function parseHostedResult(output: string): { hostedResult: Record<string, unknown>; canonicalBytes: string } {
  const trimmed = output.trim();
  if (trimmed.length < 2) throw new Error("Repository scan sandbox output is empty.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error("Repository scan sandbox output is not valid JSON.");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Repository scan sandbox output is not a hosted result object.");
  }
  return { hostedResult: parsed as Record<string, unknown>, canonicalBytes: JSON.stringify(parsed) };
}

export function createRepositoryScanExecutor(
  dependencies: RepositoryScanExecutorDependencies,
): WorkerExecutor {
  const sandbox = dependencies.sandbox ?? createPodmanSandbox();
  const now = dependencies.now ?? Date.now;
  const executor: WorkerExecutor = {
    async execute(value, signal) {
      const contract = preparedContract(value);
      if (signal.aborted) throw new DOMException("Repository scan execution was aborted.", "AbortError");
      const workDirectory = path.dirname(contract.input.sourceDirectory);
      const taskMetadataPath = path.join(workDirectory, "task.json");
      const startedAt = now();

      try {
        await writeFile(taskMetadataPath, `${JSON.stringify({
          canonicalRepositoryUrl: contract.input.canonicalRepositoryUrl,
        })}\n`, { flag: "wx", mode: 0o444 });

        let sandboxResult;
        try {
          sandboxResult = await sandbox.execute({
            podmanBinary: dependencies.podmanBinary,
            image: dependencies.scannerImage,
            taskId: contract.taskId,
            attemptId: contract.attemptId,
            sourceDirectory: contract.input.sourceDirectory,
            taskMetadataPath,
            workDirectory,
          }, signal);
        } catch (error) {
          if (signal.aborted) throw error;
          const code = error instanceof PodmanSandboxError && /container failed/i.test(error.message)
            ? "REPOSITORY_SCAN_SCANNER_FAILED"
            : "REPOSITORY_SCAN_SANDBOX_FAILED";
          return failedTerminal(contract, code, now() - startedAt);
        }

        let parsed;
        try {
          parsed = parseHostedResult(sandboxResult.output);
        } catch {
          return failedTerminal(contract, "REPOSITORY_SCAN_OUTPUT_INVALID", now() - startedAt);
        }
        const outputBytes = Buffer.byteLength(parsed.canonicalBytes, "utf8");
        if (outputBytes > contract.budget.maxOutputBytes) {
          return failedTerminal(contract, "REPOSITORY_SCAN_OUTPUT_INVALID", now() - startedAt);
        }
        const resultDigest = createHash("sha256").update(parsed.canonicalBytes, "utf8").digest("hex");
        const terminal = {
          schemaVersion: 1,
          taskId: contract.taskId,
          attemptId: contract.attemptId,
          executionClass: contract.executionClass,
          outcome: "succeeded",
          failureCode: null,
          metrics: {
            wallTimeMs: Math.min(contract.budget.maxWallTimeMs, Math.max(0, Math.trunc(now() - startedAt))),
            cpuTimeMs: 0,
            peakMemoryBytes: 0,
            inputBytes: contract.input.retainedBytes,
            outputBytes,
          },
          result: {
            kind: "phase3_repository_scan",
            snapshotId: contract.input.snapshotId,
            canonicalRepositoryUrl: contract.input.canonicalRepositoryUrl,
            resolvedCommitSha: contract.input.resolvedCommitSha,
            contentDigest: contract.input.contentDigest,
            artifactDigest: contract.input.artifactDigest,
            scannerProfileId: contract.input.scannerProfileId,
            scannerProfileVersion: contract.input.scannerProfileVersion,
            resultDigest,
            hostedResult: parsed.hostedResult,
          },
        };
        return validateWorkerTerminalEnvelope(terminal, {
          taskId: contract.taskId,
          attemptId: contract.attemptId,
          executionClass: contract.executionClass,
        });
      } finally {
        await rm(taskMetadataPath, { force: true }).catch(() => undefined);
      }
    },
  };
  return Object.freeze(executor);
}
