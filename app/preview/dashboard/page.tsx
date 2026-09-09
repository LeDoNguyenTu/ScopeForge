import Link from "next/link";
import { notFound } from "next/navigation";
import AppShell from "@/components/AppShell";
import ImmersiveDashboardExperience from "@/components/dashboard/ImmersiveDashboardExperience";
import { buildAttackSurfaceModel, type AttackSurfaceAssetInput } from "@/lib/dashboard/attack-surface-model";
import type { DashboardFinding } from "@/components/dashboard/DashboardWorkbench";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard design preview", robots: { index: false, follow: false } };

// A preview-only fixture, never an authentication bypass for /dashboard.
// Every record is synthetic; operational links still require normal sign-in.
export default async function DashboardPreview({ searchParams }: { searchParams: Promise<{ empty?: string }> }) {
  if (process.env.VERCEL_ENV !== "preview" && process.env.NODE_ENV !== "development") notFound();
  const empty = (await searchParams).empty === "1";
  const assets: AttackSurfaceAssetInput[] = empty ? [] : ["Customer portal", "Payments API", "Platform repository", "Documentation", "Partner API", "Marketing website"].map((name, index) => ({
    id: `sample-${index}`, name, kind: index === 2 ? "repository" : index === 1 || index === 4 ? "api" : "web_application",
    canonical_target: `https://sample-${index}.example.invalid`, verification_status: index === 3 ? "pending" : "verified", created_at: "2026-09-01T00:00:00Z",
  }));
  const findings: DashboardFinding[] = empty ? [] : [
    ["Exposed credential in repository configuration", "critical", "sample-2", "open"],
    ["Missing security headers on the customer portal", "high", "sample-0", "in_progress"],
    ["Overly permissive cross-origin policy", "high", "sample-1", "acknowledged"],
    ["Dependency version requires security review", "medium", "sample-2", "open"],
    ["Cookie missing the secure attribute", "medium", "sample-0", "resolved"],
    ["Unexpected server version disclosure", "low", "sample-4", "open"],
    ["Content policy needs a fresh verification", "low", "sample-5", "retest_pending"],
    ["Informational response header observed", "info", "sample-1", "open"],
  ].map(([title, severity, asset_id, lifecycle_state], index) => ({ finding_id: `example-finding-${index}`, title, severity: severity as DashboardFinding["severity"], asset_id, lifecycle_state, last_seen_at: `2026-09-0${index + 1}T10:00:00Z` }));
  const model = buildAttackSurfaceModel({ assets, findings: findings.map(finding => ({ ...finding, lifecycle_state: "open" as const })), openFindingCount: findings.length });
  return <AppShell displayName="Preview user" workspaceName="Example workspace" role="preview" variant="immersive">
    <div className="saasPreviewNotice"><span><strong>Design preview</strong> · Sample data. Workspace actions require sign-in.</span><Link href={empty ? "/preview/dashboard" : "/preview/dashboard?empty=1"}>{empty ? "View populated state" : "View empty state"}</Link><Link href="/auth/sign-in">Sign in to your workspace</Link></div>
    <ImmersiveDashboardExperience assets={assets} findings={findings} model={model} nextAction={{ href: empty ? "/dashboard/assets/new" : "/dashboard/assets", label: empty ? "Register asset" : "Review assets", title: empty ? "Register your first asset" : "Finish verifying your assets", copy: empty ? "Add an application, API, or repository that you control to start building your workspace." : "Documentation is still awaiting proof of control. Complete verification to prepare it for supported security workflows." }} />
  </AppShell>;
}