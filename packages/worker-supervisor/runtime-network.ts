import { randomBytes as nodeRandomBytes } from "node:crypto";
import {
  validateWorkerTerminalEnvelope,
  type WorkerTaskContract,
  type WorkerTerminalEnvelope,
  type WorkerTerminalFailureCode,
} from "@/packages/worker-contracts";
import { createRuntimeMediatorSessionRegistry } from "@/packages/runtime-worker-mediator/session-registry";
import { createRuntimeMediatorService, type RuntimeMediatorExecution, type RuntimeMediatorPreparedProfile } from "@/packages/runtime-worker-mediator/service";
import { validateRuntimeMediatorWireResponse } from "@/packages/runtime-worker-mediator/unix-client";
import {
  createRuntimeMediatorUnixServer,
  runtimeMediatorHostSocketPath,
} from "@/packages/runtime-worker-mediator/unix-server";
import type { RuntimeMediatorUnixServerDependencies } from "@/packages/runtime-worker-mediator/unix-server";
import {
  createRuntimeWorkerSandbox,
  type RuntimeWorkerSandbox,
} from "@/packages/runtime-worker-sandbox";
import type { PreparedRuntimeWorkerExecution } from "./control-client";
import type {
  Phase11HttpWorkerPreparedInput,
  RuntimeWorkerPreparedInput,
  WorkerExecutor,
  WorkerExecutorContract,
} from "./executor";

export interface RuntimeNetworkPreparedContract extends WorkerExecutorContract {
  executionClass:
    | "passive_runtime_observation_v1"
    | "active_cors_validation_v1"
    | "phase11_http_discovery_v1";
  input: RuntimeWorkerPreparedInput | Phase11HttpWorkerPreparedInput;
}

export interface PreparedRuntimeNetworkTask {
  contract: RuntimeNetworkPreparedContract;
  cleanup(): Promise<void>;
}

export interface RuntimeNetworkPrepareInput {
  task: WorkerTaskContract;
  prepared: PreparedRuntimeWorkerExecution;
  signal: AbortSignal;
  isCancelled: () => Promise<boolean>;
}

export interface RuntimeNetworkPreparer {
  prepare(input: RuntimeNetworkPrepareInput): Promise<PreparedRuntimeNetworkTask>;
}

export interface RuntimeNetworkPreparerDependencies {
  randomBytes?: (size: number) => Buffer;
  createUnixServer?: (
    dependencies: RuntimeMediatorUnixServerDependencies,
  ) => ReturnType<typeof createRuntimeMediatorUnixServer>;
  now?: () => Date;
}

export interface RuntimeWorkerExecutorDependencies {
  podmanBinary: string;
  runtimeImage: string;
  sandbox?: RuntimeWorkerSandbox;
  now?: () => number;
}

type RuntimeClaimIdentity =
  | Readonly<{
      executionClass: "passive_runtime_observation_v1" | "active_cors_validation_v1";
      domainJobId: string;
    }>
  | Readonly<{
      executionClass: "phase11_http_discovery_v1";
      runId: string;
      actionId: string;
      authorizationId: string;
    }>;

function runtimeTaskInput(task: WorkerTaskContract): RuntimeClaimIdentity {
  if (task.executionClass === "passive_runtime_observation_v1"
      && task.input.kind === "passive_runtime_observation") {
    return Object.freeze({ domainJobId: task.input.domainJobId, executionClass: task.executionClass });
  }
  if (task.executionClass === "active_cors_validation_v1"
      && task.input.kind === "active_cors_validation") {
    return Object.freeze({ domainJobId: task.input.domainJobId, executionClass: task.executionClass });
  }
  if (task.executionClass === "phase11_http_discovery_v1"
      && task.input.kind === "phase11_http_discovery") {
    return Object.freeze({
      executionClass: task.executionClass,
      runId: task.input.runId,
      actionId: task.input.actionId,
      authorizationId: task.input.authorizationId,
    });
  }
  throw new Error("Runtime preparation requires a closed worker task.");
}

function mediatorProfile(
  prepared: PreparedRuntimeWorkerExecution,
  executionClass: RuntimeClaimIdentity["executionClass"],
): RuntimeMediatorPreparedProfile {
  if (executionClass === "phase11_http_discovery_v1") {
    if (!("capabilityId" in prepared)) {
      throw new Error("Prepared Phase 11 HTTP profile is invalid.");
    }
    return Object.freeze({
      executionClass,
      target: prepared.target,
      capabilityId: prepared.capabilityId,
      discoveryProfile: prepared.discoveryProfile,
      methodProfile: prepared.methodProfile,
      followSameOriginRedirects: prepared.followSameOriginRedirects,
      budget: prepared.budget,
    });
  }
  if (!("executionClass" in prepared) || prepared.executionClass !== executionClass) {
    throw new Error("Prepared runtime profile does not match the claimed task.");
  }
  return Object.freeze({
    executionClass,
    target: prepared.target,
    budget: prepared.budget,
  });
}

function secretHex(randomBytes: (size: number) => Buffer): string {
  const secret = randomBytes(32);
  if (!Buffer.isBuffer(secret) || secret.length !== 32) {
    throw new Error("Runtime supervisor secret generator must return exactly 32 bytes.");
  }
  return secret.toString("hex");
}

export function createRuntimeNetworkPreparer(
  dependencies: RuntimeNetworkPreparerDependencies = {},
): RuntimeNetworkPreparer {
  const randomBytes = dependencies.randomBytes ?? nodeRandomBytes;
  const createUnixServer = dependencies.createUnixServer ?? createRuntimeMediatorUnixServer;
  const now = dependencies.now ?? (() => new Date());

  return Object.freeze({
    async prepare({ task, prepared, signal, isCancelled }: RuntimeNetworkPrepareInput) {
      const claimed = runtimeTaskInput(task);
      if (prepared.taskId !== task.taskId) {
        throw new Error("Prepared runtime profile does not match the claimed task.");
      }
      if (claimed.executionClass === "phase11_http_discovery_v1") {
        if (!("capabilityId" in prepared)
            || prepared.runId !== claimed.runId
            || prepared.actionId !== claimed.actionId
            || prepared.authorizationId !== claimed.authorizationId) {
          throw new Error("Prepared Phase 11 HTTP profile does not match the claimed task.");
        }
      } else if (!("executionClass" in prepared)
          || prepared.attemptId !== task.attemptId
          || prepared.executionClass !== claimed.executionClass
          || prepared.domainJobId !== claimed.domainJobId) {
        throw new Error("Prepared runtime profile does not match the claimed task.");
      }
      const expiresAtMs = Date.parse(prepared.expiresAt);
      if (!Number.isFinite(expiresAtMs) || expiresAtMs <= now().getTime()) {
        throw new Error("Prepared runtime profile is already expired.");
      }
      if (signal.aborted) {
        throw new DOMException("Runtime worker preparation was aborted.", "AbortError");
      }
      if (await isCancelled()) {
        throw new DOMException("Runtime worker preparation was cancelled.", "AbortError");
      }

      const authoritativeCancellation = async () => signal.aborted || await isCancelled();
      const registry = createRuntimeMediatorSessionRegistry<RuntimeMediatorPreparedProfile>({ randomBytes });
      const mediatorSession = registry.register({
        taskId: task.taskId,
        attemptId: task.attemptId,
        executionClass: claimed.executionClass,
        expiresAt: prepared.expiresAt,
        profile: mediatorProfile(prepared, claimed.executionClass),
      });
      const socketPath = runtimeMediatorHostSocketPath(secretHex(randomBytes));
      const mediator = createRuntimeMediatorService({
        registry,
        passive: { isCancelled: authoritativeCancellation, signal },
        activeCors: { isCancelled: authoritativeCancellation, signal },
        httpDiscovery: { isCancelled: authoritativeCancellation, signal },
        now,
      });
      const server = createUnixServer({ socketPath, run: mediator.run });

      try {
        await server.start();
        if (signal.aborted || await isCancelled()) {
          await server.close();
          throw new DOMException("Runtime worker preparation was aborted.", "AbortError");
        }
      } catch (error) {
        await server.close().catch(() => undefined);
        throw error;
      }

      const contract: RuntimeNetworkPreparedContract = Object.freeze({
        taskId: task.taskId,
        attemptId: task.attemptId,
        executionClass: claimed.executionClass,
        absoluteDeadlineAt: task.absoluteDeadlineAt,
        budget: task.budget,
        input: claimed.executionClass === "phase11_http_discovery_v1"
          ? Object.freeze({
              kind: "phase11_http_worker_prepared" as const,
              runId: claimed.runId,
              actionId: claimed.actionId,
              authorizationId: claimed.authorizationId,
              mediatorSocketPath: socketPath,
              mediatorSession,
            })
          : Object.freeze({
              kind: "runtime_worker_prepared" as const,
              domainJobId: claimed.domainJobId,
              mediatorSocketPath: socketPath,
              mediatorSession,
            }),
      });

      return Object.freeze({
        contract,
        cleanup: async () => {
          await server.close();
        },
      });
    },
  });
}

function preparedRuntimeContract(value: WorkerExecutorContract): RuntimeNetworkPreparedContract {
  const legacyRuntime = (value.executionClass === "passive_runtime_observation_v1"
      || value.executionClass === "active_cors_validation_v1")
    && value.input.kind === "runtime_worker_prepared";
  const phase11Runtime = value.executionClass === "phase11_http_discovery_v1"
    && value.input.kind === "phase11_http_worker_prepared";
  if (!legacyRuntime && !phase11Runtime) {
    throw new Error("Runtime executor received an unprepared runtime contract.");
  }
  const input = value.input as RuntimeWorkerPreparedInput | Phase11HttpWorkerPreparedInput;
  if (input.mediatorSession.taskId !== value.taskId
      || input.mediatorSession.attemptId !== value.attemptId
      || input.mediatorSession.executionClass !== value.executionClass) {
    throw new Error("Runtime executor mediator identity does not match the prepared task.");
  }
  return value as RuntimeNetworkPreparedContract;
}

function boundedWallTime(startedAt: number, now: () => number, maximum: number): number {
  return Math.min(maximum, Math.max(0, Math.trunc(now() - startedAt)));
}

function terminalMetrics(
  contract: RuntimeNetworkPreparedContract,
  wallTimeMs: number,
  outputBytes: number,
) {
  return Object.freeze({
    wallTimeMs,
    cpuTimeMs: 0,
    peakMemoryBytes: 0,
    inputBytes: 0,
    outputBytes: Math.min(contract.budget.maxOutputBytes, Math.max(0, outputBytes)),
  });
}

function failedRuntimeTerminal(
  contract: RuntimeNetworkPreparedContract,
  failureCode: WorkerTerminalFailureCode,
  wallTimeMs: number,
  outputBytes = 0,
): WorkerTerminalEnvelope {
  return validateWorkerTerminalEnvelope({
    schemaVersion: 1,
    taskId: contract.taskId,
    attemptId: contract.attemptId,
    executionClass: contract.executionClass,
    outcome: "failed",
    failureCode,
    metrics: terminalMetrics(contract, wallTimeMs, outputBytes),
    result: null,
  }, {
    taskId: contract.taskId,
    attemptId: contract.attemptId,
    executionClass: contract.executionClass,
  });
}

function terminalFromMediatorExecution(
  contract: RuntimeNetworkPreparedContract,
  execution: RuntimeMediatorExecution,
  wallTimeMs: number,
  outputBytes: number,
): WorkerTerminalEnvelope {
  const terminal = execution.status === "succeeded"
    ? {
        schemaVersion: 1 as const,
        taskId: contract.taskId,
        attemptId: contract.attemptId,
        executionClass: contract.executionClass,
        outcome: "succeeded" as const,
        failureCode: null,
        metrics: terminalMetrics(contract, wallTimeMs, outputBytes),
        result: execution.result,
      }
    : execution.status === "cancelled"
      ? {
          schemaVersion: 1 as const,
          taskId: contract.taskId,
          attemptId: contract.attemptId,
          executionClass: contract.executionClass,
          outcome: "cancelled" as const,
          failureCode: null,
          metrics: terminalMetrics(contract, wallTimeMs, outputBytes),
          result: null,
        }
      : {
          schemaVersion: 1 as const,
          taskId: contract.taskId,
          attemptId: contract.attemptId,
          executionClass: contract.executionClass,
          outcome: "failed" as const,
          failureCode: execution.failureCode,
          metrics: terminalMetrics(contract, wallTimeMs, outputBytes),
          result: null,
        };

  return validateWorkerTerminalEnvelope(terminal, {
    taskId: contract.taskId,
    attemptId: contract.attemptId,
    executionClass: contract.executionClass,
  });
}

export function createRuntimeWorkerExecutor(
  dependencies: RuntimeWorkerExecutorDependencies,
): WorkerExecutor {
  const sandbox = dependencies.sandbox ?? createRuntimeWorkerSandbox();
  const now = dependencies.now ?? Date.now;

  return Object.freeze({
    async execute(value: WorkerExecutorContract, signal: AbortSignal) {
      const contract = preparedRuntimeContract(value);
      const startedAt = now();
      let sandboxOutput: string;

      try {
        const result = await sandbox.execute({
          podmanBinary: dependencies.podmanBinary,
          image: dependencies.runtimeImage,
          taskId: contract.taskId,
          attemptId: contract.attemptId,
          executionClass: contract.executionClass,
          mediatorSessionNonce: contract.input.mediatorSession.nonce,
          mediatorSocketPath: contract.input.mediatorSocketPath,
        }, signal);
        sandboxOutput = result.output;
      } catch {
        return failedRuntimeTerminal(
          contract,
          "RUNTIME_WORKER_EXECUTION_FAILED",
          boundedWallTime(startedAt, now, contract.budget.maxWallTimeMs),
        );
      }

      const outputBytes = Buffer.byteLength(sandboxOutput, "utf8");
      if (outputBytes > contract.budget.maxOutputBytes) {
        return failedRuntimeTerminal(
          contract,
          "RUNTIME_WORKER_OUTPUT_INVALID",
          boundedWallTime(startedAt, now, contract.budget.maxWallTimeMs),
          contract.budget.maxOutputBytes,
        );
      }

      try {
        const trimmed = sandboxOutput.trim();
        if (trimmed.length === 0) throw new Error("empty runtime output");
        const decoded = JSON.parse(trimmed) as unknown;
        const execution = validateRuntimeMediatorWireResponse(
          decoded,
          contract.executionClass,
        ) as RuntimeMediatorExecution;
        return terminalFromMediatorExecution(
          contract,
          execution,
          boundedWallTime(startedAt, now, contract.budget.maxWallTimeMs),
          outputBytes,
        );
      } catch {
        return failedRuntimeTerminal(
          contract,
          "RUNTIME_WORKER_OUTPUT_INVALID",
          boundedWallTime(startedAt, now, contract.budget.maxWallTimeMs),
          outputBytes,
        );
      }
    },
  });
}
