import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database.types";

const SENSITIVE_CREDENTIAL_KEY = /(token|secret|password|credential|authorization|cookie|api[_-]?key|private[_-]?key|service[_-]?role[_-]?key)/i;

const FORBIDDEN_CONTENT_KEYS = new Set([
  "requestbody",
  "responsebody",
  "source",
  "sourcecode",
  "stdout",
  "stderr",
  "environment",
  "headers",
]);

function normalizeMetadataKey(key: string): string {
  return key.toLowerCase().replace(/[_-]/g, "");
}

export function assertSafeAuditMetadata(value: Json, path = "metadata"): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertSafeAuditMetadata(item, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      if (
        SENSITIVE_CREDENTIAL_KEY.test(key)
        || FORBIDDEN_CONTENT_KEYS.has(normalizeMetadataKey(key))
      ) {
        throw new Error(`Sensitive audit metadata key is not allowed: ${path}.${key}`);
      }
      if (nested !== undefined) assertSafeAuditMetadata(nested, `${path}.${key}`);
    }
  }
}

export async function writeAuditEvent(input: {
  supabase: SupabaseClient<Database>;
  workspaceId: string;
  eventType: string;
  actorId: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Json;
}): Promise<void> {
  const metadata = input.metadata ?? {};
  assertSafeAuditMetadata(metadata);

  const serialized = JSON.stringify(metadata);
  if (Buffer.byteLength(serialized, "utf8") > 8 * 1024) throw new Error("Audit metadata exceeds 8 KiB.");

  const { error } = await input.supabase.from("audit_events").insert({
    workspace_id: input.workspaceId,
    actor_type: "user",
    actor_id: input.actorId,
    event_type: input.eventType,
    target_type: input.targetType ?? null,
    target_id: input.targetId ?? null,
    metadata
  });

  if (error) throw new Error(`Unable to record audit event: ${error.message}`);
}
