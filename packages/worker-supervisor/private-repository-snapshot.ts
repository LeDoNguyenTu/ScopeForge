import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type {
  GitHubPrivateArchiveLease,
  PrivateRepositorySnapshotInput,
  PrivateRepositorySnapshotResult,
  RepositorySnapshotUploadDescriptor,
  WorkerAttemptMetrics,
  WorkerExecutionBudget,
  WorkerTerminalFailureCode,
} from "@/packages/worker-contracts";
import type { GitHubArchiveStream } from "@/packages/repository-acquisition-network";
import { uploadRepositorySnapshotArtifact } from "@/packages/repository-snapshot-network/upload";
import {
  parseGitHubRepositoryArchive,
  writeRepositorySnapshotBundle,
  type ParsedRepositoryArchive,
  type RepositorySnapshotBundle,
} from "@/packages/repository-snapshot";

type ParseArchive = typeof parseGitHubRepositoryArchive;
type WriteBundle = typeof writeRepositorySnapshotBundle;

export interface PrivateRepositorySnapshotExecutorContract {
  taskId: string;
  attemptId: string;
  executionClass: "repository_snapshot_github_private_v1";
  absoluteDeadlineAt: string;
  budget: WorkerExecutionBudget;
  input: PrivateRepositorySnapshotInput;
}

export interface PrivateRepositorySnapshotTerminalEnvelope {
  schemaVersion: 1;
  taskId: string;
  attemptId: string;
  executionClass: "repository_snapshot_github_private_v1";
  outcome: "succeeded" | "failed" | "cancelled";
  failureCode: WorkerTerminalFailureCode | null;
  metrics: WorkerAttemptMetrics;
  result: PrivateRepositorySnapshotResult | null;
}

export interface PrivateRepositorySnapshotExecutor {
  execute(
    contract: PrivateRepositorySnapshotExecutorContract,
    signal: AbortSignal,
  ): Promise<PrivateRepositorySnapshotTerminalEnvelope>;
}

export interface PrivateRepositorySnapshotExecutorDependencies {
  source: {
    openArchive(
      lease: GitHubPrivateArchiveLease,
      signal: AbortSignal,
    ): Promise<GitHubArchiveStream>;
  };
  upload?: (input: {
    descriptor: RepositorySnapshotUploadDescriptor;
    artifactPath: string;
    storedArtifactBytes: number;
    signal: AbortSignal;
  }) => Promise<void>;
  parseArchive?: ParseArchive;
  writeBundle?: WriteBundle;
  createWorkDirectory?: () => Promise<string>;
  removeWorkDirectory?: (directory: string) => Promise<void>;
  now?: () => number;
  cpuUsage?: () => { user: number; system: number };
  memoryUsage?: () => { rss: number };
}

type ExecutionStage = "archive" | "parse" | "bundle" | "upload";

function isAbort(error: unknown, signal: AbortSignal): boolean {
  return signal.aborted
    || (error instanceof DOMException && error.name === "AbortError")
    || (error instanceof Error && error.name === "AbortError");
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "";
}

function failureCode(stage: ExecutionStage, error: unknown): WorkerTerminalFailureCode {
  const message = messageOf(error).toLowerCase();
  if (stage === "archive") {
    if (
      message.includes("redirect")
      || message.includes("codeload")
      || message.includes("dns")
      || message.includes("blocked address")
      || message.includes("https")
      || message.includes("tls")
      || message.includes("network")
      || message.includes("capability")
    ) return "REPOSITORY_NETWORK_POLICY_FAILED";
    if (message.includes("compressed-byte") || message.includes("exceeds")) {
      return "REPOSITORY_ARCHIVE_BUDGET_EXCEEDED";
    }
    return "REPOSITORY_UNAVAILABLE";
  }
  if (stage === "parse" || stage === "bundle") {
    if (
      message.includes("exceeds")
      || message.includes("safety bound")
      || message.includes("entry-count")
      || message.includes("artifact-byte")
      || message.includes("execution budget")
    ) return "REPOSITORY_ARCHIVE_BUDGET_EXCEEDED";
    return "REPOSITORY_ARCHIVE_UNSAFE";
  }
  return "REPOSITORY_ARTIFACT_UPLOAD_FAILED";
}

function validPrivateContract(contract: PrivateRepositorySnapshotExecutorContract): boolean {
  return contract.executionClass === "repository_snapshot_github_private_v1"
    && contract.input.kind === "repository_snapshot_github_private"
    && contract.input.privateArchiveLease.canonicalRepositoryUrl === contract.input.canonicalRepositoryUrl;
}

function metrics(input: {
  contract: PrivateRepositorySnapshotExecutorContract;
  startedAt: number;
  startedCpu: { user: number; system: number };
  inputBytes: number;
  resultBytes: number;
  dependencies: PrivateRepositorySnapshotExecutorDependencies;
}): WorkerAttemptMetrics {
  const now = input.dependencies.now ?? Date.now;
  const cpuUsage = input.dependencies.cpuUsage ?? (() => process.cpuUsage());
  const memoryUsage = input.dependencies.memoryUsage ?? (() => process.memoryUsage());
  const finishedCpu = cpuUsage();
  const wallTimeMs = Math.max(0, Math.trunc(now() - input.startedAt));
  const cpuTimeMs = Math.max(0, Math.trunc(
    (finishedCpu.user - input.startedCpu.user + finishedCpu.system - input.startedCpu.system) / 1000,
  ));
  return Object.freeze({
    wallTimeMs: Math.min(wallTimeMs, input.contract.budget.maxWallTimeMs),
    cpuTimeMs: Math.min(cpuTimeMs, input.contract.budget.maxCpuTimeMs),
    peakMemoryBytes: Math.min(Math.max(0, Math.trunc(memoryUsage().rss)), input.contract.budget.maxMemoryBytes),
    inputBytes: Math.min(Math.max(0, Math.trunc(input.inputBytes)), input.contract.budget.maxInputBytes),
    outputBytes: Math.min(Math.max(0, Math.trunc(input.resultBytes)), input.contract.budget.maxOutputBytes),
  });
}

function terminal(
  contract: PrivateRepositorySnapshotExecutorContract,
  outcome: "failed" | "cancelled",
  failureCodeValue: WorkerTerminalFailureCode | null,
  executionMetrics: WorkerAttemptMetrics,
): PrivateRepositorySnapshotTerminalEnvelope {
  return Object.freeze({
    schemaVersion: 1,
    taskId: contract.taskId,
    attemptId: contract.attemptId,
    executionClass: "repository_snapshot_github_private_v1",
    outcome,
    failureCode: failureCodeValue,
    metrics: executionMetrics,
    result: null,
  });
}

export function createPrivateRepositorySnapshotExecutor(
  dependencies: PrivateRepositorySnapshotExecutorDependencies,
): PrivateRepositorySnapshotExecutor {
  const parseArchive = dependencies.parseArchive ?? parseGitHubRepositoryArchive;
  const writeBundle = dependencies.writeBundle ?? writeRepositorySnapshotBundle;
  const upload = dependencies.upload ?? uploadRepositorySnapshotArtifact;
  const createWorkDirectory = dependencies.createWorkDirectory
    ?? (() => mkdtemp(path.join(tmpdir(), "scopeforge-private-repository-snapshot-")));
  const removeWorkDirectory = dependencies.removeWorkDirectory
    ?? ((directory: string) => rm(directory, { recursive: true, force: true }));
  const now = dependencies.now ?? Date.now;
  const cpuUsage = dependencies.cpuUsage ?? (() => process.cpuUsage());

  return Object.freeze({
    async execute(contract, signal) {
      let inputBytes = 0;
      const startedAt = now();
      const startedCpu = cpuUsage();
      const emptyMetrics = () => metrics({
        contract,
        startedAt,
        startedCpu,
        inputBytes,
        resultBytes: 0,
        dependencies,
      });

      if (signal.aborted) return terminal(contract, "cancelled", null, emptyMetrics());
      if (!validPrivateContract(contract)) {
        return terminal(contract, "failed", "WORKER_OUTPUT_INVALID", emptyMetrics());
      }

      let workDirectory: string | null = null;
      let stage: ExecutionStage = "archive";
      try {
        const archive = await dependencies.source.openArchive(
          contract.input.privateArchiveLease,
          signal,
        );
        if (archive.contentLength !== null) inputBytes = archive.contentLength;

        workDirectory = await createWorkDirectory();
        stage = "parse";
        const parsed: ParsedRepositoryArchive = await parseArchive({
          archive: archive.response,
          expectedCommitSha: contract.input.privateArchiveLease.resolvedCommitSha,
          workDirectory,
          signal,
        });
        inputBytes = parsed.compressedBytes;

        stage = "bundle";
        const bundle: RepositorySnapshotBundle = await writeBundle({
          files: parsed.files,
          source: {
            canonicalRepositoryUrl: contract.input.canonicalRepositoryUrl,
            defaultBranch: contract.input.privateArchiveLease.defaultBranch,
            resolvedCommitSha: contract.input.privateArchiveLease.resolvedCommitSha,
          },
          skipCounts: parsed.skipCounts,
          workDirectory,
          signal,
        });

        stage = "upload";
        await upload({
          descriptor: contract.input.artifactUpload,
          artifactPath: bundle.artifactPath,
          storedArtifactBytes: bundle.storedArtifactBytes,
          signal,
        });

        const result: PrivateRepositorySnapshotResult = Object.freeze({
          kind: "repository_snapshot_github_private",
          canonicalRepositoryUrl: contract.input.canonicalRepositoryUrl,
          defaultBranch: contract.input.privateArchiveLease.defaultBranch,
          resolvedCommitSha: contract.input.privateArchiveLease.resolvedCommitSha,
          contentDigest: bundle.contentDigest,
          artifactDigest: bundle.artifactDigest,
          compressedBytes: parsed.compressedBytes,
          expandedBytes: parsed.expandedBytes,
          retainedFileCount: bundle.retainedFileCount,
          retainedBytes: bundle.retainedBytes,
          storedArtifactBytes: bundle.storedArtifactBytes,
          skipCounts: bundle.skipCounts,
        });
        const resultBytes = new TextEncoder().encode(JSON.stringify(result)).byteLength;
        return Object.freeze({
          schemaVersion: 1 as const,
          taskId: contract.taskId,
          attemptId: contract.attemptId,
          executionClass: "repository_snapshot_github_private_v1" as const,
          outcome: "succeeded" as const,
          failureCode: null,
          metrics: metrics({
            contract,
            startedAt,
            startedCpu,
            inputBytes,
            resultBytes,
            dependencies,
          }),
          result,
        });
      } catch (error) {
        const executionMetrics = emptyMetrics();
        if (isAbort(error, signal)) return terminal(contract, "cancelled", null, executionMetrics);
        return terminal(contract, "failed", failureCode(stage, error), executionMetrics);
      } finally {
        if (workDirectory !== null) await removeWorkDirectory(workDirectory);
      }
    },
  });
}
