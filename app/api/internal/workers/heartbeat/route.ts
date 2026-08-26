import { authenticateWorkerRequest } from "@/lib/worker-control/auth";
import { workerJson, workerRouteError } from "@/lib/worker-control/http-response";
import {
  authenticateWorkerNode,
  heartbeatWorkerAttempt,
} from "@/lib/worker-control/service";
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
    const dependencies = createWorkerControlServerDependencies();
    const worker = await authenticateWorkerRequest(request, {
      authenticate: (input) => authenticateWorkerNode(input, dependencies),
    });
    const body = strictObject(await readBoundedWorkerJson(request), ["taskId", "attemptId", "leaseToken"]);

    const result = await heartbeatWorkerAttempt({
      workerId: worker.workerId,
      taskId: workerUuid(body.taskId),
      attemptId: workerUuid(body.attemptId),
      leaseToken: leaseToken(body.leaseToken),
    }, dependencies);
    return workerJson({ ok: true, data: result });
  } catch (error) {
    return workerRouteError(error);
  }
}
