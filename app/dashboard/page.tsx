import AppShell from "@/components/AppShell";
import ImmersiveDashboardExperience from "@/components/dashboard/ImmersiveDashboardExperience";
import {
  buildAttackSurfaceModel,
} from "@/lib/dashboard/attack-surface-model";
import { demoAssets, demoFindings, demoIdentity } from "@/lib/demo/fixtures";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  const { workspaceName, ...identity } = demoIdentity;
  const workspace = { name: workspaceName };
  const { role, displayName } = identity;
  const workspaceAssets = demoAssets;
  const findingSample = demoFindings;
  const surfaceModel = buildAttackSurfaceModel({ assets: workspaceAssets, findings: demoFindings });

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
        assets={workspaceAssets}
        findings={findingSample ?? []}
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
