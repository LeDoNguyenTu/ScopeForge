import { randomBytes as nodeRandomBytes } from "node:crypto";
import type { WorkerTaskContract } from "@/packages/worker-contracts";
import { createRuntimeMediatorSessionRegistry } from "@/packages/runtime-worker-mediator/session-registry";
import { createRuntimeMediatorService, type RuntimeMediatorPreparedProfile } from "@/packages/runtime-worker-mediator/service";
import {
  createRuntimeMediatorUnixServer,
  runtimeMediatorHostSocketPath,
} from "@/packages/runtime-worker-mediator/unix-server";
import type { RuntimeMediatorUnixServerDependencies } from "@/packages/runtime-worker-mediator/unix-server";
import type { PreparedRuntimeWorkerExecution } from "./control-client";
import type { RuntimeWorkerPreparedInput, WorkerExecutorContract } from "./executor";

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
    async prepare({ task, prepared, signal }) {
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
