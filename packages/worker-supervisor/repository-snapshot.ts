import { createReadStream } from "node:fs";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { request as httpsRequest } from "node:https";
import { tmpdir } from "node:os";
import path from "node:path";
import type {
  RepositorySnapshotUploadDescriptor,
  WorkerAttemptMetrics,
  WorkerTerminalEnvelope,
  WorkerTerminalFailureCode,
} from "@/packages/worker-contracts";
import type { GitHubRepositoryAcquirer } from "@/packages/repository-acquisition-network";
import {
  parseGitHubRepositoryArchive,
  writeRepositorySnapshotBundle,
  type ParsedRepositoryArchive,
  type RepositorySnapshotBundle,
} from "@/packages/repository-snapshot";
import type { WorkerExecutor, WorkerExecutorContract } from "./executor";

const R2_UPLOAD_HOST_PATTERN = /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?[.][a-f0-9]{32}[.]r2[.]cloudflarestorage[.]com$/;
const R2_UPLOAD_PATH_PATTERN = /^\/repository-source\/[a-f0-9]{64}[.]tar[.]gz$/;

type ParseArchive = typeof parseGitHubRepositoryArchive;
type WriteBundle = typeof writeRepositorySnapshotBundle;

export interface RepositorySnapshotExecutorDependencies {
  github: GitHubRepositoryAcquirer;
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

type ExecutionStage = "resolve" | "archive" | "parse" | "bundle" | "upload";

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
  if (stage === "resolve") {
    if (message.includes("identity changed")) return "REPOSITORY_IDENTITY_CHANGED";
    if (
      message.includes("private")
      || message.includes("dns")
      || message.includes("blocked address")
      || message.includes("https")
      || message.includes("tls")
      || message.includes("network")
    ) return "REPOSITORY_NETWORK_POLICY_FAILED";
    return "REPOSITORY_UNAVAILABLE";
  }
  if (stage === "archive") {
    if (
      message.includes("redirect")
      || message.includes("dns")
      || message.includes("blocked address")
      || message.includes("https")
      || message.includes("tls")
      || message.includes("network")
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

function assertRepositoryContract(contract: WorkerExecutorContract): asserts contract is WorkerExecutorContract & {
  executionClass: "repository_snapshot_github_public_v1";
  input: Extract<WorkerExecutorContract["input"], { kind: "repository_snapshot_github_public" }>;
} {
  if (
    contract.executionClass !== "repository_snapshot_github_public_v1"
    || contract.input.kind !== "repository_snapshot_github_public"
  ) {
    throw new Error("Repository snapshot executor received the wrong execution class.");
  }
}

function metrics(input: {
  contract: WorkerExecutorContract;
  startedAt: number;
  startedCpu: { user: number; system: number };
  inputBytes: number;
  resultBytes: number;
  dependencies: RepositorySnapshotExecutorDependencies;
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

function cancelledTerminal(
  contract: WorkerExecutorContract,
  executionMetrics: WorkerAttemptMetrics,
): WorkerTerminalEnvelope {
  return Object.freeze({
    schemaVersion: 1,
    taskId: contract.taskId,
    attemptId: contract.attemptId,
    executionClass: contract.executionClass,
    outcome: "cancelled",
    failureCode: null,
    metrics: executionMetrics,
    result: null,
  });
}

function failedTerminal(
  contract: WorkerExecutorContract,
  code: WorkerTerminalFailureCode,
  executionMetrics: WorkerAttemptMetrics,
): WorkerTerminalEnvelope {
  return Object.freeze({
    schemaVersion: 1,
    taskId: contract.taskId,
    attemptId: contract.attemptId,
    executionClass: contract.executionClass,
    outcome: "failed",
    failureCode: code,
    metrics: executionMetrics,
    result: null,
  });
}

function assertUploadDescriptor(descriptor: RepositorySnapshotUploadDescriptor): URL {
  if (descriptor.method !== "PUT") throw new Error("Repository snapshot upload method is invalid.");
  const expiresAt = Date.parse(descriptor.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    throw new Error("Repository snapshot upload authorization is expired.");
  }
  let url: URL;
  try {
    url = new URL(descriptor.url);
  } catch {
    throw new Error("Repository snapshot upload URL is invalid.");
  }
  if (
    url.protocol !== "https:"
    || (url.port && url.port !== "443")
    || url.username
    || url.password
    || url.hash
    || !R2_UPLOAD_HOST_PATTERN.test(url.hostname.toLowerCase())
    || !R2_UPLOAD_PATH_PATTERN.test(url.pathname)
    || !url.searchParams.has("X-Amz-Signature")
  ) {
    throw new Error("Repository snapshot upload URL violates the closed R2 policy.");
  }
  return url;
}

export async function uploadRepositorySnapshotArtifact(input: {
  descriptor: RepositorySnapshotUploadDescriptor;
  artifactPath: string;
  storedArtifactBytes: number;
  signal: AbortSignal;
}): Promise<void> {
  if (input.signal.aborted) throw new DOMException("Repository artifact upload was aborted.", "AbortError");
  const url = assertUploadDescriptor(input.descriptor);
  const metadata = await stat(input.artifactPath);
  if (!metadata.isFile() || metadata.size !== input.storedArtifactBytes || metadata.size < 1) {
    throw new Error("Repository snapshot artifact size does not match upload provenance.");
  }

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const request = httpsRequest(url, {
      method: "PUT",
      headers: {
        "content-length": String(input.storedArtifactBytes),
        "content-type": "application/gzip",
        "if-none-match": "*",
      },
      agent: false,
    }, (response) => {
      response.resume();
      if (response.statusCode !== undefined && response.statusCode >= 200 && response.statusCode < 300) {
        response.once("end", () => finish(resolve));
      } else {
        response.once("end", () => finish(() => reject(new Error("Repository snapshot object upload was rejected."))));
      }
    });
    const source = createReadStream(input.artifactPath, { highWaterMark: 64 * 1024 });

    const finish = (callback: (() => void) | ((value?: never) => void)) => {
      if (settled) return;
      settled = true;
      input.signal.removeEventListener("abort", onAbort);
      source.destroy();
      callback();
    };
    const onAbort = () => {
      request.destroy(new DOMException("Repository artifact upload was aborted.", "AbortError"));
      finish(() => reject(new DOMException("Repository artifact upload was aborted.", "AbortError")));
    };
    if (input.signal.aborted) {
      onAbort();
      return;
    }
    input.signal.addEventListener("abort", onAbort, { once: true });
    request.once("error", (error) => finish(() => reject(error)));
    source.once("error", (error) => {
      request.destroy(error);
      finish(() => reject(error));
    });
    source.pipe(request);
  });
}

export function createRepositorySnapshotExecutor(
  dependencies: RepositorySnapshotExecutorDependencies,
): WorkerExecutor {
  const parseArchive = dependencies.parseArchive ?? parseGitHubRepositoryArchive;
  const writeBundle = dependencies.writeBundle ?? writeRepositorySnapshotBundle;
  const upload = dependencies.upload ?? uploadRepositorySnapshotArtifact;
  const createWorkDirectory = dependencies.createWorkDirectory
    ?? (() => mkdtemp(path.join(tmpdir(), "scopeforge-repository-snapshot-")));
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

      if (signal.aborted) return cancelledTerminal(contract, emptyMetrics());
      try {
        assertRepositoryContract(contract);
      } catch {
        return failedTerminal(contract, "WORKER_OUTPUT_INVALID", emptyMetrics());
      }

      let workDirectory: string | null = null;
      let stage: ExecutionStage = "resolve";
      try {
        const resolution = await dependencies.github.resolveRepository(
          contract.input.owner,
          contract.input.repository,
          signal,
        );
        if (resolution.canonicalRepositoryUrl !== contract.input.canonicalRepositoryUrl) {
          return failedTerminal(contract, "REPOSITORY_IDENTITY_CHANGED", emptyMetrics());
        }

        stage = "archive";
        const archive = await dependencies.github.openArchive(
          contract.input.owner,
          contract.input.repository,
          resolution.commitSha,
          signal,
        );
        if (archive.contentLength !== null) inputBytes = archive.contentLength;

        workDirectory = await createWorkDirectory();
        stage = "parse";
        const parsed: ParsedRepositoryArchive = await parseArchive({
          archive: archive.response,
          expectedCommitSha: resolution.commitSha,
          workDirectory,
          signal,
        });
        inputBytes = parsed.compressedBytes;

        stage = "bundle";
        const bundle: RepositorySnapshotBundle = await writeBundle({
          files: parsed.files,
          source: {
            canonicalRepositoryUrl: resolution.canonicalRepositoryUrl,
            defaultBranch: resolution.defaultBranch,
            resolvedCommitSha: resolution.commitSha,
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

        const result = Object.freeze({
          kind: "repository_snapshot_github_public" as const,
          canonicalRepositoryUrl: resolution.canonicalRepositoryUrl,
          defaultBranch: resolution.defaultBranch,
          resolvedCommitSha: resolution.commitSha,
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
          executionClass: "repository_snapshot_github_public_v1" as const,
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
        if (isAbort(error, signal)) return cancelledTerminal(contract, executionMetrics);
        return failedTerminal(contract, failureCode(stage, error), executionMetrics);
      } finally {
        if (workDirectory !== null) await removeWorkDirectory(workDirectory);
      }
    },
  });
}
