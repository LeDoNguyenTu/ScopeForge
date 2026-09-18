import type {
  CancelledQueueReference,
  QueueApprovedActionInput,
  QueueApprovedActionResult,
} from "@/lib/pentest-runs/types";
import {
  parsePhase11HttpClosedParameters,
  phase11HttpRequiredRequestCapacity,
} from "./closed-parameters";

const TASK_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ACTION_ID = /^phase11-action:[0-9a-f]{64}$/;
const AUTHORIZATION_ID = /^phase11-authz:[0-9a-f]{64}$/;
const QUEUE_PREFIX = "phase11-http-worker:";
const CAPABILITIES = new Set(["web.http.probe.v1", "web.route.discover.v1"]);

export interface Phase11HttpWorkerQueueRepository {
  enqueue(input: {
    workspaceId: string;
    runId: string;
    actionId: string;
    authorizationId: string;
  }): Promise<{ taskId: string; replayed: boolean }>;
  cancel(input: {
    workspaceId: string;
    runId: string;
    actionId: string;
    taskId: string;
  }): Promise<{ cancelled: boolean; replayed: boolean }>;
}

function fail(code: string): never {
  throw new Error(code);
}

function validateQueueInput(input: QueueApprovedActionInput): void {
  const { intent, authorization } = input;
  if (input.workspaceId !== authorization.workspaceId
      || intent.actionId !== authorization.actionId
      || intent.capabilityId !== authorization.capabilityId
      || input.idempotencyKey !== authorization.authorizationId) {
    fail("PHASE11_HTTP_QUEUE_IDENTITY_MISMATCH");
  }
  if (!ACTION_ID.test(intent.actionId) || !AUTHORIZATION_ID.test(authorization.authorizationId)) {
    fail("PHASE11_HTTP_QUEUE_IDENTITY_INVALID");
  }
  if (!CAPABILITIES.has(intent.capabilityId)
      || authorization.capabilityVersion !== "1.0.0"
      || intent.requestedMode !== "safe_active"
      || authorization.executionMode !== "safe_active") {
    fail("PHASE11_HTTP_QUEUE_CAPABILITY_INVALID");
  }
  if (intent.targetNodeIds.length !== 1
      || authorization.targetNodeIds.length !== 1
      || intent.targetNodeIds[0] !== authorization.targetNodeIds[0]) {
    fail("PHASE11_HTTP_QUEUE_TARGET_INVALID");
  }
  const params = parsePhase11HttpClosedParameters(
    intent.closedParameters,
    intent.capabilityId as "web.http.probe.v1" | "web.route.discover.v1",
  );
  const requiredRequests = phase11HttpRequiredRequestCapacity(params);
  if (!Number.isInteger(authorization.maxRequests)
      || authorization.maxRequests < requiredRequests
      || authorization.maxRequests > 12
      || !Number.isInteger(authorization.maxRuntimeMs)
      || authorization.maxRuntimeMs < 1
      || authorization.maxRuntimeMs > 30_000) {
    fail("PHASE11_HTTP_QUEUE_BUDGET_INVALID");
  }
  if (!Number.isFinite(Date.parse(authorization.expiresAt))) {
    fail("PHASE11_HTTP_QUEUE_EXPIRY_INVALID");
  }
}

function queueReference(taskId: string): string {
  if (!TASK_ID.test(taskId)) fail("PHASE11_HTTP_QUEUE_TASK_INVALID");
  return QUEUE_PREFIX + taskId;
}

function taskIdFromQueueReference(value: string): string {
  if (!value.startsWith(QUEUE_PREFIX)) fail("PHASE11_HTTP_QUEUE_REFERENCE_INVALID");
  const taskId = value.slice(QUEUE_PREFIX.length);
  if (!TASK_ID.test(taskId)) fail("PHASE11_HTTP_QUEUE_REFERENCE_INVALID");
  return taskId;
}

export function createPhase11HttpWorkerQueueAdapter(
  repository: Phase11HttpWorkerQueueRepository,
): {
  enqueueApprovedAction(input: QueueApprovedActionInput): Promise<QueueApprovedActionResult>;
  cancelQueuedAction(input: CancelledQueueReference & {
    workspaceId: string;
    runId: string;
  }): Promise<void>;
} {
  return Object.freeze({
    async enqueueApprovedAction(input) {
      validateQueueInput(input);
      const queued = await repository.enqueue({
        workspaceId: input.workspaceId,
        runId: input.runId,
        actionId: input.intent.actionId,
        authorizationId: input.authorization.authorizationId,
      });
      return Object.freeze({ queueReference: queueReference(queued.taskId) });
    },

    async cancelQueuedAction(input) {
      const taskId = taskIdFromQueueReference(input.queueReference);
      const result = await repository.cancel({
        workspaceId: input.workspaceId,
        runId: input.runId,
        actionId: input.actionId,
        taskId,
      });
      if (!result.cancelled) fail("PHASE11_HTTP_QUEUE_CANCELLATION_FAILED");
    },
  });
}
