import type { SupabaseClient } from "@supabase/supabase-js";
import type { Phase11cWorkerDatabase } from "@/lib/database.phase11c.types";
import type { Phase11HttpWorkerQueueRepository } from "./queue";

function fail(code: string): never {
  throw new Error(code);
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail("PHASE11_HTTP_QUEUE_PERSISTENCE_FAILED");
  }
  return value as Record<string, unknown>;
}

function exact(value: Record<string, unknown>, keys: readonly string[]): void {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    fail("PHASE11_HTTP_QUEUE_PERSISTENCE_FAILED");
  }
}

function parseEnqueue(value: unknown): { taskId: string; replayed: boolean } {
  const data = record(value);
  exact(data, ["taskId", "replayed"]);
  if (typeof data.taskId !== "string"
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.taskId)
      || typeof data.replayed !== "boolean") {
    fail("PHASE11_HTTP_QUEUE_PERSISTENCE_FAILED");
  }
  return Object.freeze({ taskId: data.taskId, replayed: data.replayed });
}

function parseCancel(value: unknown): { cancelled: boolean; replayed: boolean } {
  const data = record(value);
  exact(data, ["cancelled", "replayed"]);
  if (typeof data.cancelled !== "boolean" || typeof data.replayed !== "boolean") {
    fail("PHASE11_HTTP_QUEUE_PERSISTENCE_FAILED");
  }
  return Object.freeze({ cancelled: data.cancelled, replayed: data.replayed });
}

export function createPhase11HttpWorkerQueueRepository(
  client: SupabaseClient<Phase11cWorkerDatabase>,
): Phase11HttpWorkerQueueRepository {
  return Object.freeze({
    async enqueue(input) {
      const { data, error } = await client.rpc("enqueue_phase11_http_worker_task", {
        target_workspace_id: input.workspaceId,
        target_run_id: input.runId,
        target_action_id: input.actionId,
        target_authorization_id: input.authorizationId,
      });
      if (error) fail("PHASE11_HTTP_QUEUE_PERSISTENCE_FAILED");
      return parseEnqueue(data);
    },

    async cancel(input) {
      const { data, error } = await client.rpc("cancel_phase11_http_worker_task", {
        target_workspace_id: input.workspaceId,
        target_run_id: input.runId,
        target_action_id: input.actionId,
        target_task_id: input.taskId,
      });
      if (error) fail("PHASE11_HTTP_QUEUE_CANCELLATION_FAILED");
      return parseCancel(data);
    },
  });
}
