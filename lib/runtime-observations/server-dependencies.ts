import { writeAuditEvent } from "@/lib/audit/write-audit-event";
import type { Database } from "@/lib/database.types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createRuntimeObservationRepository } from "./repository";
import type {
  RuntimeObservationAuditEvent,
  RuntimeObservationServiceDependencies,
} from "./service";

type AssetRow = Database["public"]["Tables"]["assets"]["Row"];

export function createRuntimeObservationServerDependencies(): RuntimeObservationServiceDependencies {
  const admin = createAdminClient();
  const repository = createRuntimeObservationRepository(admin);

  async function loadAsset(assetId: string, workspaceId: string): Promise<AssetRow | null> {
    const { data, error } = await admin
      .from("assets")
      .select("*")
      .eq("id", assetId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (error) throw new Error("Unable to load the runtime observation asset.");
    return data;
  }

  async function audit(event: RuntimeObservationAuditEvent): Promise<void> {
    await writeAuditEvent({
      supabase: admin,
      workspaceId: event.workspaceId,
      eventType: event.eventType,
      actorId: event.actorId,
      targetType: "asset",
      targetId: event.assetId,
      metadata: {
        jobId: event.jobId,
        details: event.metadata,
      },
    });
  }

  return Object.freeze({ repository, loadAsset, audit });
}
