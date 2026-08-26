import { createRepositorySnapshotServerDependencies } from "@/lib/repository-snapshots/server-dependencies";
import { publishRepositorySnapshotAttempt } from "@/lib/repository-snapshots/service";
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

function isRepositorySnapshotSuccess(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return candidate.executionClass === "repository_snapshot_github_public_v1"
    && candidate.outcome === "succeeded";
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

    const result = isRepositorySnapshotSuccess(body.terminal)
      ? await publishRepositorySnapshotAttempt({
          workerId: worker.workerId,
          leaseToken: body.leaseToken,
          terminal: body.terminal,
        }, createRepositorySnapshotServerDependencies())
      : await finalizeWorkerAttempt({
          workerId: worker.workerId,
          leaseToken: body.leaseToken,
          terminal: body.terminal,
        }, dependencies);
    return workerJson({ ok: true, data: result });
  } catch (error) {
    return workerRouteError(error);
  }
}
