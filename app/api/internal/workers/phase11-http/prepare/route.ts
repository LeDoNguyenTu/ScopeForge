import { prepareLeasedPhase11HttpWorker } from "@/lib/phase11-http-worker/leased-preparation";
import { createPhase11HttpWorkerPreparationServerDependencies } from "@/lib/phase11-http-worker/server-dependencies";
import { authenticateWorkerRequest } from "@/lib/worker-control/auth";
import { workerJson, workerRouteError } from "@/lib/worker-control/http-response";
import { authenticateWorkerNode } from "@/lib/worker-control/service";
import { createWorkerControlServerDependencies } from "@/lib/worker-control/server-dependencies";
import {
  readBoundedWorkerJson,
  strictObject,
  WorkerTransportError,
  workerUuid,
} from "@/lib/worker-control/transport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function leaseToken(value: unknown): string {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) {
    throw new WorkerTransportError("WORKER_REQUEST_INVALID", 400);
  }
  return value;
}

export async function POST(request: Request): Promise<Response> {
  try {
    const workerDependencies = createWorkerControlServerDependencies();
    const worker = await authenticateWorkerRequest(request, {
      authenticate: (input) => authenticateWorkerNode(input, workerDependencies),
    });
    if (worker.executionClass !== "phase11_http_discovery_v1") {
      throw new WorkerTransportError("WORKER_REQUEST_INVALID", 403);
    }
    const body = strictObject(await readBoundedWorkerJson(request), ["taskId", "attemptId", "leaseToken"]);
    const result = await prepareLeasedPhase11HttpWorker({
      workerId: worker.workerId,
      taskId: workerUuid(body.taskId),
      attemptId: workerUuid(body.attemptId),
      leaseToken: leaseToken(body.leaseToken),
    }, createPhase11HttpWorkerPreparationServerDependencies());
    return workerJson({ ok: true, data: result });
  } catch (error) {
    if (error instanceof Error && /^PHASE11_HTTP_[A-Z0-9_]{1,48}$/.test(error.message)) {
      return workerJson({ error: { code: error.message } }, 409);
    }
    return workerRouteError(error, "worker.phase11_http_prepare");
  }
}
