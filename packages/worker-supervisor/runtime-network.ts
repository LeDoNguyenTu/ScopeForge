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
  RuntimeWorkerPreparedInput,
  WorkerExecutor,
  WorkerExecutorContract,
} from "./executor";

export interface RuntimeNetworkPreparedContract extends WorkerExecutorContract {
  executionClass: "passive_runtime_observation_v1" | "active_cors_validation_v1";
  input: RuntimeWorkerPreparedInput;
}

export interface PreparedRuntimeNetworkTask {
  contract: RuntimeNetworkPreparedContract;
  cleanup(): Promise<void>;
}

export interface RuntimeNetworkPrepareInput {
  task: WorkerTaskContract;
  prepared: PreparedRuntimeWorkerExecution;
  signal: AbortSignal;
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

function runtimeTaskInput(task: WorkerTaskContract): {
  domainJobId: string;
  executionClass: "passive_runtime_observation_v1" | "active_cors_validation_v1";
} {
  if (task.executionClass === "passive_runtime_observation_v1"
      && task.input.kind === "passive_runtime_observation") {
    return { domainJobId: task.input.domainJobId, executionClass: task.executionClass };
  }
  if (task.executionClass === "active_cors_validation_v1"
      && task.input.kind === "active_cors_validation") {
    return { domainJobId: task.input.domainJobId, executionClass: task.executionClass };
  }
  throw new Error("Phase 6D preparation requires a closed runtime worker task.");
}

function mediatorProfile(prepared: PreparedRuntimeWorkerExecution): RuntimeMediatorPreparedProfile {
  if (prepared.executionClass === "passive_runtime_observation_v1") {
    return Object.freeze({
      executionClass: prepared.executionClass,
      target: prepared.target,
      budget: prepared.budget,
    });
  }
  return Object.freeze({
    executionClass: prepared.executionClass,
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
    async prepare({ task, prepared, signal }: RuntimeNetworkPrepareInput) {
      const claimed = runtimeTaskInput(task);
      if (prepared.taskId !== task.taskId
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

      const registry = createRuntimeMediatorSessionRegistry<RuntimeMediatorPreparedProfile>({ randomBytes });
      const mediatorSession = registry.register({
        taskId: task.taskId,
        attemptId: task.attemptId,
        executionClass: claimed.executionClass,
        expiresAt: prepared.expiresAt,
        profile: mediatorProfile(prepared),
      });
      const socketPath = runtimeMediatorHostSocketPath(secretHex(randomBytes));
      const mediator = createRuntimeMediatorService({
        registry,
        passive: { isCancelled: () => signal.aborted },
        activeCors: { isCancelled: () => signal.aborted },
        now,
      });
      const server = createUnixServer({ socketPath, run: mediator.run });

      try {
        await server.start();
        if (signal.aborted) {
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
        input: Object.freeze({
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
  if ((value.executionClass !== "passive_runtime_observation_v1"
      && value.executionClass !== "active_cors_validation_v1")
      || value.input.kind !== "runtime_worker_prepared") {
    throw new Error("Runtime executor received an unprepared Phase 6D contract.");
  }
  if (value.input.mediatorSession.taskId !== value.taskId
      || value.input.mediatorSession.attemptId !== value.attemptId
      || value.input.mediatorSession.executionClass !== value.executionClass) {
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
    async execute(value, signal) {
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
