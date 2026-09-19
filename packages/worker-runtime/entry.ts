import {
  createPrivateRepositorySnapshotExecutor,
  createRepositoryScanExecutor,
  createRepositoryScanPreparer,
  createRuntimeNetworkPreparer,
  createRuntimeWorkerExecutor,
  runWorkerOnce,
  type AnyWorkerExecutor,
  type AnyWorkerExecutorContract,
} from "@/packages/worker-supervisor";
import type { AnyWorkerTerminalEnvelope } from "@/packages/worker-contracts";
import { createPrivateRepositoryArchiveReader } from "@/packages/repository-acquisition-network";
import { readWorkerRuntimeConfig } from "./config";
import { createWorkerHttpControlClient } from "./http-control-client";
import { runWorkerLoop } from "./runner";

function log(event: Readonly<Record<string, string | undefined>>): void {
  process.stdout.write(`${JSON.stringify(event)}\n`);
}

async function main(): Promise<void> {
  const config = readWorkerRuntimeConfig(process.env);
  const control = createWorkerHttpControlClient({
    baseUrl: config.baseUrl,
    workerId: config.workerId,
    secret: config.secret,
    expectedExecutionClass: config.executionClass,
  });
  const controller = new AbortController();
  process.once("SIGINT", () => controller.abort());
  process.once("SIGTERM", () => controller.abort());

  const privateExecutor = config.executionClass === "repository_snapshot_github_private_v1"
    ? createPrivateRepositorySnapshotExecutor({ source: createPrivateRepositoryArchiveReader() })
    : null;
  const scanExecutor = config.executionClass === "phase3_repository_scan_no_egress_v1"
    ? createRepositoryScanExecutor({ podmanBinary: config.podmanBinary, scannerImage: config.scannerImage })
    : null;
  const runtimeExecutor = config.executionClass === "phase11_http_discovery_v1"
    ? createRuntimeWorkerExecutor({ podmanBinary: config.podmanBinary, runtimeImage: config.runtimeImage })
    : null;
  const executor: AnyWorkerExecutor = Object.freeze({
    async execute(contract: AnyWorkerExecutorContract, signal: AbortSignal): Promise<AnyWorkerTerminalEnvelope> {
      if (contract.executionClass === "repository_snapshot_github_private_v1" && privateExecutor) {
        return await privateExecutor.execute(contract, signal);
      }
      if (contract.executionClass === "phase3_repository_scan_no_egress_v1" && scanExecutor) {
        return await scanExecutor.execute(contract, signal);
      }
      if (contract.executionClass === "phase11_http_discovery_v1" && runtimeExecutor) {
        return await runtimeExecutor.execute(contract, signal);
      }
      throw new Error("Worker received a task outside its configured execution class.");
    },
  });
  const repositoryScanPreparer = config.executionClass === "phase3_repository_scan_no_egress_v1"
    ? createRepositoryScanPreparer({ workRoot: config.workRoot, expectedHost: config.expectedR2Host })
    : undefined;
  const runtimeNetworkPreparer = config.executionClass === "phase11_http_discovery_v1"
    ? createRuntimeNetworkPreparer()
    : undefined;

  log({ event: "worker_runtime_started", executionClass: config.executionClass });
  await runWorkerLoop({
    signal: controller.signal,
    pollMs: config.pollMs,
    log,
    runOnce: () => runWorkerOnce({
      control,
      executor,
      ...(repositoryScanPreparer ? { repositoryScanPreparer } : {}),
      ...(runtimeNetworkPreparer ? { runtimeNetworkPreparer } : {}),
    }),
  });
  log({ event: "worker_runtime_stopped", executionClass: config.executionClass });
}

void main().catch((error: unknown) => {
  const code = typeof error === "object" && error !== null && "code" in error
    && typeof (error as { code?: unknown }).code === "string"
    ? (error as { code: string }).code
    : "WORKER_RUNTIME_START_FAILED";
  log({ event: "worker_runtime_start_failed", code });
  process.exitCode = 1;
});
