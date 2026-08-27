import { createRepositoryScanArtifactAccess } from "@/lib/repository-scans/artifact-access";
import { createRepositoryScanArtifactRepository } from "@/lib/repository-scans/repository";
import { RepositoryScanError } from "@/lib/repository-scans/types";
import { createRepositorySnapshotObjectStore } from "@/lib/repository-snapshots/server-store";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateWorkerRequest } from "@/lib/worker-control/auth";
import { workerJson, workerRouteError } from "@/lib/worker-control/http-response";
import { authenticateWorkerNode } from "@/lib/worker-control/service";
import { createWorkerControlServerDependencies } from "@/lib/worker-control/server-dependencies";
import {
  readBoundedWorkerJson,
  strictObject,
  workerUuid,
  WorkerTransportError,
} from "@/lib/worker-control/transport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    const workerDependencies = createWorkerControlServerDependencies();
    const worker = await authenticateWorkerRequest(request, {
      authenticate: (input) => authenticateWorkerNode(input, workerDependencies),
    });
    if (worker.executionClass !== "phase3_repository_scan_no_egress_v1") {
      throw new RepositoryScanError("WORKER_LEASE_INVALID");
    }

    const body = strictObject(await readBoundedWorkerJson(request), ["taskId", "attemptId", "leaseToken"]);
    const taskId = workerUuid(body.taskId);
    const attemptId = workerUuid(body.attemptId);
    if (typeof body.leaseToken !== "string" || !/^[a-f0-9]{64}$/.test(body.leaseToken)) {
      throw new WorkerTransportError("WORKER_REQUEST_INVALID", 400);
    }

    const admin = createAdminClient();
    const result = await createRepositoryScanArtifactAccess({
      workerId: worker.workerId,
      taskId,
      attemptId,
      leaseToken: body.leaseToken,
    }, {
      repository: createRepositoryScanArtifactRepository(admin),
      objectStore: createRepositorySnapshotObjectStore(),
    });

    return workerJson({ ok: true, data: result });
  } catch (error) {
    return workerRouteError(error);
  }
}