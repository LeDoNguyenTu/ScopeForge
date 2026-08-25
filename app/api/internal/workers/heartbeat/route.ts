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
} from "@/lib/worker-control/transport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function boundedString(value: unknown, maximum: number): string {
  if (typeof value !== "string" || value.length < 1 || value.length > maximum) {
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
    const leaseToken = boundedString(body.leaseToken, 64);
    if (!/^[a-f0-9]{64}$/.test(leaseToken)) {
      throw new WorkerTransportError("WORKER_REQUEST_INVALID", 400);
    }

    const result = await heartbeatWorkerAttempt({
      workerId: worker.workerId,
      taskId: boundedString(body.taskId, 64),
      attemptId: boundedString(body.attemptId, 64),
      leaseToken,
    }, dependencies);
    return workerJson({ ok: true, data: result });
  } catch (error) {
    return workerRouteError(error);
  }
}
