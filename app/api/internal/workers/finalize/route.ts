import { createRepositorySnapshotServerDependencies } from "@/lib/repository-snapshots/server-dependencies";
import {
  publishPrivateRepositorySnapshotAttempt,
  publishRepositorySnapshotAttempt,
} from "@/lib/repository-snapshots/service";
import { continueConnectedProjectScanAfterSnapshot } from "@/lib/project-scans/service";
import { authenticateWorkerRequest } from "@/lib/worker-control/auth";
import { workerJson, workerRouteError } from "@/lib/worker-control/http-response";
import {
  authenticateWorkerNode,
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

      return workerJson({ ok: true, data: result });
    }

    const result = await finalizeWorkerAttempt({
      workerId: worker.workerId,
      leaseToken: body.leaseToken,
      terminal: body.terminal,
    }, dependencies);
    return workerJson({ ok: true, data: result });
  } catch (error) {
    return workerRouteError(error, "worker.finalize");
  }
}
