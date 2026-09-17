import { createRepositorySnapshotServerDependencies } from "@/lib/repository-snapshots/server-dependencies";
import {
  publishPrivateRepositorySnapshotAttempt,
  publishRepositorySnapshotAttempt,
} from "@/lib/repository-snapshots/service";
import {
  automaticProjectScanReconciliationRequiresRetry,
  continueConnectedProjectScanAfterSnapshot,
  reconcileConnectedProjectScanTerminal,
  reconcileConnectedProjectSnapshotTerminal,
  reconcilePendingAutomaticProjectScanAfterRepositoryScanTerminal,
} from "@/lib/project-scans/service";
import { authenticateWorkerRequest } from "@/lib/worker-control/auth";
import { workerJson, workerRouteError } from "@/lib/worker-control/http-response";
import {
  authenticateWorkerNode,
  finalizePrivateRepositorySnapshotFailureAttempt,
  finalizeWorkerAttempt,
} from "@/lib/worker-control/service";
import { createWorkerControlServerDependencies } from "@/lib/worker-control/server-dependencies";
import {
  readBoundedWorkerJson,
  strictObject,
  WorkerTransportError,
} from "@/lib/worker-control/transport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RepositorySnapshotSuccessKind = "public" | "private";

function repositorySnapshotSuccessKind(value: unknown): RepositorySnapshotSuccessKind | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (candidate.outcome !== "succeeded") return null;
  if (candidate.executionClass === "repository_snapshot_github_public_v1") return "public";
  if (candidate.executionClass === "repository_snapshot_github_private_v1") return "private";
  return null;
}

function isPrivateRepositorySnapshotTerminal(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  return (value as Record<string, unknown>).executionClass === "repository_snapshot_github_private_v1";
}

function isRepositoryScanTerminal(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  return (value as Record<string, unknown>).executionClass === "phase3_repository_scan_no_egress_v1";
}

function failedRepositorySnapshotTaskId(value: unknown): string | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (
    candidate.executionClass !== "repository_snapshot_github_public_v1"
    && candidate.executionClass !== "repository_snapshot_github_private_v1"
  ) return null;
  if (candidate.outcome !== "failed" && candidate.outcome !== "cancelled") return null;
  return typeof candidate.taskId === "string" ? candidate.taskId : null;
}

function failedRepositoryScanTaskId(value: unknown): string | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (candidate.executionClass !== "phase3_repository_scan_no_egress_v1") return null;
  if (candidate.outcome !== "failed" && candidate.outcome !== "cancelled") return null;
  return typeof candidate.taskId === "string" ? candidate.taskId : null;
}

export async function POST(request: Request): Promise<Response> {
  try {
    const dependencies = createWorkerControlServerDependencies();
    const worker = await authenticateWorkerRequest(request, {
      authenticate: (input) => authenticateWorkerNode(input, dependencies),
    });
    const body = strictObject(await readBoundedWorkerJson(request), ["leaseToken", "terminal"]);
    if (typeof body.leaseToken !== "string" || !/^[a-f0-9]{64}$/.test(body.leaseToken)) {
      throw new WorkerTransportError("WORKER_REQUEST_INVALID", 400);
    }

    const snapshotKind = repositorySnapshotSuccessKind(body.terminal);
    if (snapshotKind) {
      const snapshotDependencies = createRepositorySnapshotServerDependencies();
      const snapshotInput = {
        workerId: worker.workerId,
        leaseToken: body.leaseToken,
        terminal: body.terminal,
      };
      const result = snapshotKind === "private"
        ? await publishPrivateRepositorySnapshotAttempt(snapshotInput, snapshotDependencies)
        : await publishRepositorySnapshotAttempt(snapshotInput, snapshotDependencies);

      if (result.outcome === "succeeded" && result.snapshotId) {
        await continueConnectedProjectScanAfterSnapshot({
          snapshotTaskId: result.taskId,
          snapshotId: result.snapshotId,
        });
      }

      return workerJson({
        ok: true,
        data: { outcome: result.outcome, replayed: result.replayed },
      });
    }

    const repositoryScanTerminal = isRepositoryScanTerminal(body.terminal);
    const snapshotTaskId = failedRepositorySnapshotTaskId(body.terminal);
    const scanTaskId = failedRepositoryScanTaskId(body.terminal);
    const result = isPrivateRepositorySnapshotTerminal(body.terminal)
      ? await finalizePrivateRepositorySnapshotFailureAttempt({
          workerId: worker.workerId,
          leaseToken: body.leaseToken,
          terminal: body.terminal,
        }, dependencies)
      : await finalizeWorkerAttempt({
          workerId: worker.workerId,
          leaseToken: body.leaseToken,
          terminal: body.terminal,
        }, dependencies);
    if (snapshotTaskId) {
      await reconcileConnectedProjectSnapshotTerminal({ snapshotTaskId });
    }
    if (repositoryScanTerminal) {
      const automaticReconciliation = await reconcilePendingAutomaticProjectScanAfterRepositoryScanTerminal({
        scanTaskId: result.taskId,
      });
      if (automaticProjectScanReconciliationRequiresRetry(automaticReconciliation)) {
        throw new Error("AUTOMATIC_PROJECT_SCAN_RECONCILIATION_RETRY_REQUIRED");
      }
    }
    if (scanTaskId) {
      await reconcileConnectedProjectScanTerminal({ scanTaskId });
    }
    return workerJson({
      ok: true,
      data: { outcome: result.outcome, replayed: result.replayed },
    });
  } catch (error) {
    return workerRouteError(error, "worker.finalize");
  }
}
