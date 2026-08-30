import { authenticateWorkerRequest } from "@/lib/worker-control/auth";
import { workerJson, workerRouteError } from "@/lib/worker-control/http-response";
import { authenticateWorkerNode } from "@/lib/worker-control/service";
import { createWorkerControlServerDependencies } from "@/lib/worker-control/server-dependencies";
import {
  readBoundedWorkerJsonWithLimit,
  strictObject,
  WorkerTransportError,
  workerUuid,
} from "@/lib/worker-control/transport";
import { RuntimeWorkerError } from "@/lib/runtime-workers/errors";
import { publishRuntimeWorkerTerminal } from "@/lib/runtime-workers/publication";
import { createRuntimeWorkerPublicationServerDependencies } from "@/lib/runtime-workers/publication-server-dependencies";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RUNTIME_FINALIZE_MAX_BODY_BYTES = 196_608;

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
    if (worker.executionClass !== "passive_runtime_observation_v1"
        && worker.executionClass !== "active_cors_validation_v1") {
      throw new RuntimeWorkerError("RUNTIME_WORKER_TASK_INVALID");
    }

    const body = strictObject(
      await readBoundedWorkerJsonWithLimit(request, RUNTIME_FINALIZE_MAX_BODY_BYTES),
      ["taskId", "attemptId", "leaseToken", "terminal"],
    );
    const result = await publishRuntimeWorkerTerminal({
      workerId: worker.workerId,
      taskId: workerUuid(body.taskId),
      attemptId: workerUuid(body.attemptId),
      leaseToken: leaseToken(body.leaseToken),
      terminal: body.terminal,
    }, createRuntimeWorkerPublicationServerDependencies());

    return workerJson({ ok: true, data: result });
  } catch (error) {
    if (error instanceof RuntimeWorkerError) {
      return workerJson({ error: { code: error.code } }, 409);
    }
    return workerRouteError(error);
  }
}
