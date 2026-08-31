import type { Database } from "@/lib/database.types";
import type { Phase6dDatabase } from "@/lib/database.phase6d.types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createRuntimeWorkerPreparationContextRepository } from "./preparation-context";
import type { RuntimeWorkerPreparationDependencies } from "./preparation";

type AssetRow = Database["public"]["Tables"]["assets"]["Row"];
type ScanJobRow = Database["public"]["Tables"]["scan_jobs"]["Row"];

export function createRuntimeWorkerPreparationServerDependencies(): RuntimeWorkerPreparationDependencies {
  const admin = createAdminClient();
  const controlAdmin = createAdminClient<Phase6dDatabase>();
  const contextRepository = createRuntimeWorkerPreparationContextRepository(controlAdmin);

  async function loadAsset(assetId: string, workspaceId: string): Promise<AssetRow | null> {
    const { data, error } = await admin
      .from("assets")
      .select("*")
      .eq("id", assetId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (error) throw new Error("Unable to load runtime worker asset.");
    return data;
  }

  async function loadJob(
    jobId: string,
    workspaceId: string,
    jobKind: "passive_runtime" | "active_validation",
  ): Promise<ScanJobRow | null> {
    const { data, error } = await admin
      .from("scan_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("workspace_id", workspaceId)
      .eq("job_kind", jobKind)
      .maybeSingle();
    if (error) throw new Error("Unable to load runtime worker domain job.");
    return data;
  }

  return Object.freeze({
    getPreparationContext: contextRepository.getPreparationContext,
    loadAsset,
    loadPassiveJob: (jobId: string, workspaceId: string) => loadJob(jobId, workspaceId, "passive_runtime"),
    loadActiveJob: (jobId: string, workspaceId: string) => loadJob(jobId, workspaceId, "active_validation"),
    commitPreparation: contextRepository.commitPreparation,
  });
}
