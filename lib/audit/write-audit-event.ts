import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database.types";

const SENSITIVE_KEY = /(token|secret|password|credential|authorization|cookie|api[_-]?key)/i;

function assertSafeMetadata(value: Json, path = "metadata"): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertSafeMetadata(item, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      if (SENSITIVE_KEY.test(key)) throw new Error(`Sensitive audit metadata key is not allowed: ${path}.${key}`);
      if (nested !== undefined) assertSafeMetadata(nested, `${path}.${key}`);
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
  assertSafeMetadata(metadata);

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
