import { finalizeLeasedPhase11HttpWorker } from "@/lib/phase11-http-worker/finalization";
import { createPhase11HttpWorkerFinalizationServerDependencies } from "@/lib/phase11-http-worker/finalization-server-dependencies";
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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 65_536;

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
    const body = strictObject(
      await readBoundedWorkerJsonWithLimit(request, MAX_BODY_BYTES),
      ["taskId", "attemptId", "leaseToken", "terminal"],
    );
    const result = await finalizeLeasedPhase11HttpWorker({
      workerId: worker.workerId,
      taskId: workerUuid(body.taskId),
      attemptId: workerUuid(body.attemptId),
      leaseToken: leaseToken(body.leaseToken),
      terminal: body.terminal,
    }, createPhase11HttpWorkerFinalizationServerDependencies());
    return workerJson({ ok: true, data: result });
  } catch (error) {
    if (error instanceof Error && /^PHASE11_HTTP_WORKER_[A-Z0-9_]{1,48}$/.test(error.message)) {
      const status = error.message.endsWith("TERMINAL_INVALID") ? 400 : 409;
      return workerJson({ error: { code: error.message } }, status);
    }
    return workerRouteError(error, "worker.phase11_http_finalize");
  }
}
