import AppShell from "@/components/AppShell";
import ImmersiveDashboardExperience from "@/components/dashboard/ImmersiveDashboardExperience";
import {
  buildAttackSurfaceModel,
  type AttackSurfaceFindingInput,
} from "@/lib/dashboard/attack-surface-model";
import { getDashboardContext } from "@/lib/workspaces/current";

export const dynamic = "force-dynamic";

const ACTIVE_FINDING_STATES = [
  "open",
  "acknowledged",
  "in_progress",
  "resolved",
  "retest_pending",
] as const;

export default async function DashboardPage() {
  const { supabase, workspace, role, displayName } = await getDashboardContext();
  const [
    { data: assets, error: assetsError },
    { count: openFindingCount, error: findingCountError },
    { data: findingSample, error: findingSampleError },
  ] = await Promise.all([
    supabase
      .from("assets")
      .select("id,kind,name,canonical_target,verification_status,created_at")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("security_findings")
      .select("finding_id", { count: "exact", head: true })
      .eq("workspace_id", workspace.id)
      .in("lifecycle_state", [...ACTIVE_FINDING_STATES]),
    supabase
      .from("security_findings")
      .select("asset_id,severity,title,lifecycle_state,last_seen_at")
      .eq("workspace_id", workspace.id)
      .in("lifecycle_state", [...ACTIVE_FINDING_STATES])
      .order("last_seen_at", { ascending: false })
      .limit(250),
  ]);

  if (assetsError) throw new Error(assetsError.message);
  if (findingCountError) throw new Error(findingCountError.message);
  if (findingSampleError) throw new Error(findingSampleError.message);

  const workspaceAssets = assets ?? [];
  const activeFindings: AttackSurfaceFindingInput[] = (findingSample ?? []).map((finding) => ({
    asset_id: finding.asset_id,
    severity: finding.severity,
    title: finding.title,
    lifecycle_state: finding.lifecycle_state as AttackSurfaceFindingInput["lifecycle_state"],
  }));
  const surfaceModel = buildAttackSurfaceModel({
    assets: workspaceAssets,
    findings: activeFindings,
    openFindingCount: openFindingCount ?? 0,
  });

  const firstNeedsProof = workspaceAssets.find((asset) => asset.verification_status !== "verified");
  const openWorkCount = surfaceModel.metrics.openFindings;

  const nextHref = workspaceAssets.length === 0
    ? "/dashboard/assets/new"
    : firstNeedsProof
      ? `/dashboard/assets/${firstNeedsProof.id}`
      : openWorkCount > 0
        ? "/dashboard/findings"
        : "/dashboard/assets";
  const nextTitle = workspaceAssets.length === 0
    ? "Register your first asset"
    : firstNeedsProof
      ? "Verify asset control"
      : openWorkCount > 0
        ? `${openWorkCount} finding${openWorkCount === 1 ? "" : "s"} need review`
        : "Your verified scope is ready";
  const nextCopy = workspaceAssets.length === 0
    ? "Start by defining an application, API, or repository that belongs in this workspace's authorized scope."
    : firstNeedsProof
      ? "Proof of control remains the safety boundary before any remote observation or active validation can run."
      : openWorkCount > 0
        ? "Review canonical evidence, validation confidence, and lifecycle history before choosing the next remediation step."
        : "Review verified assets and run only the bounded security workflows that match the authorization policy.";
  const nextActionLabel = workspaceAssets.length === 0
    ? "Register asset"
    : firstNeedsProof
      ? "Continue verification"
      : openWorkCount > 0
        ? "Review findings"
        : "Review assets";

  return (
    <AppShell
      displayName={displayName}
      workspaceName={workspace.name}
      role={role}
      variant="immersive"
    >
      <ImmersiveDashboardExperience
        model={surfaceModel}
        nextAction={{
          href: nextHref,
          label: nextActionLabel,
          title: nextTitle,
          copy: nextCopy,
        }}
      />
    </AppShell>
  );
}
