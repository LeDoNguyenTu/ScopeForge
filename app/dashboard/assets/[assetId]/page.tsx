import Link from "next/link";
import { notFound } from "next/navigation";
import { Activity, ArrowLeft, CircleCheck, Clock3, FileClock, ShieldCheck } from "lucide-react";
import AppShell from "@/components/AppShell";
import ActiveValidationPanel, {
  type ActiveValidationPanelObservation,
} from "@/components/assets/ActiveValidationPanel";
import RepositoryImportPanel, {
  type RepositoryImportHistoryItem,
} from "@/components/assets/RepositoryImportPanel";
import RepositoryScanPanel from "@/components/assets/RepositoryScanPanel";
import RepositorySnapshotPanel from "@/components/assets/RepositorySnapshotPanel";
import RuntimeObservationPanel, {
  type RuntimeObservationPanelObservation,
} from "@/components/assets/RuntimeObservationPanel";
import VerificationPanel from "@/components/assets/VerificationPanel";
import type { Json } from "@/lib/database.types";
import { createPhase3ImportRepository } from "@/lib/phase3-import/repository";
import {
  loadRepositoryScanReadModel,
  type RepositoryScanHistoryItem,
  type RepositoryScanJobSummary,
} from "@/lib/repository-scans/read-model";
import {
  listRepositorySnapshots,
  type RepositorySnapshotHistoryItem,
} from "@/lib/repository-snapshots/read-model";
import { HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED } from "@/lib/repository-snapshots/runtime";
import { getDashboardContext } from "@/lib/workspaces/current";

export const dynamic = "force-dynamic";

function observationSummary(payload: Json): RuntimeObservationPanelObservation | null {
  if (!payload || Array.isArray(payload) || typeof payload !== "object") return null;
  const kind = typeof payload.kind === "string" ? payload.kind : null;
  if (!kind || kind === "cors-policy") return null;

  return {
    kind,
    name: typeof payload.name === "string" ? payload.name : undefined,
    present: typeof payload.present === "boolean" ? payload.present : undefined,
    value: typeof payload.value === "string" ? payload.value : undefined,
    protocol: typeof payload.protocol === "string" || payload.protocol === null ? payload.protocol : undefined,
    validFrom: typeof payload.validFrom === "string" || payload.validFrom === null ? payload.validFrom : undefined,
    validTo: typeof payload.validTo === "string" || payload.validTo === null ? payload.validTo : undefined,
    status: typeof payload.status === "number" ? payload.status : undefined,
  };
}

function activeObservationSummary(payload: Json): ActiveValidationPanelObservation | null {
  if (!payload || Array.isArray(payload) || typeof payload !== "object") return null;
  if (payload.kind !== "cors-policy") return null;
  if (typeof payload.url !== "string" || typeof payload.status !== "number") return null;
  if (payload.allowedOrigin !== null && typeof payload.allowedOrigin !== "string") return null;
  if (typeof payload.credentialsAllowed !== "boolean" || typeof payload.variesOnOrigin !== "boolean") return null;

  return {
    kind: "cors-policy",
    url: payload.url,
    status: payload.status,
    allowedOrigin: payload.allowedOrigin,
    credentialsAllowed: payload.credentialsAllowed,
    variesOnOrigin: payload.variesOnOrigin,
  };
}

export default async function AssetDetailPage({ params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;
  const { supabase, workspace, role, displayName } = await getDashboardContext();

  const [
    { data: asset, error },
    { data: events },
    { data: latestJob, error: latestJobError },
    { data: latestActiveJob, error: latestActiveJobError },
  ] = await Promise.all([
    supabase
      .from("assets")
      .select("id,name,kind,canonical_target,hostname,verification_status,verified_at,created_at")
      .eq("id", assetId)
      .eq("workspace_id", workspace.id)
      .maybeSingle(),
    supabase
      .from("audit_events")
      .select("id,event_type,created_at,metadata")
      .eq("workspace_id", workspace.id)
      .eq("target_id", assetId)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("scan_jobs")
      .select("id,status,blocked_reason,failure_code,request_count,redirect_count,finding_count,cancel_requested_at,created_at")
      .eq("workspace_id", workspace.id)
      .eq("asset_id", assetId)
      .eq("job_kind", "passive_runtime")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("scan_jobs")
      .select("id,status,blocked_reason,failure_code,request_count,finding_count,cancel_requested_at,created_at")
      .eq("workspace_id", workspace.id)
      .eq("asset_id", assetId)
      .eq("job_kind", "active_validation")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (error) throw new Error(error.message);
  if (latestJobError) throw new Error(latestJobError.message);
  if (latestActiveJobError) throw new Error(latestActiveJobError.message);
  if (!asset) notFound();

  let observations: RuntimeObservationPanelObservation[] = [];
  if (latestJob?.status === "succeeded") {
    const { data: observationRows, error: observationError } = await supabase
      .from("runtime_observations")
      .select("payload,sequence")
      .eq("workspace_id", workspace.id)
      .eq("asset_id", asset.id)
      .eq("job_id", latestJob.id)
      .neq("kind", "cors-policy")
      .order("sequence", { ascending: true });
    if (observationError) throw new Error(observationError.message);
    observations = (observationRows ?? [])
      .map((row) => observationSummary(row.payload))
      .filter((item): item is RuntimeObservationPanelObservation => item !== null);
  }

  let activeObservation: ActiveValidationPanelObservation | null = null;
  if (latestActiveJob?.status === "succeeded") {
    const { data: activeObservationRow, error: activeObservationError } = await supabase
      .from("runtime_observations")
      .select("payload")
      .eq("workspace_id", workspace.id)
      .eq("asset_id", asset.id)
      .eq("job_id", latestActiveJob.id)
      .eq("kind", "cors-policy")
      .limit(1)
      .maybeSingle();
    if (activeObservationError) throw new Error(activeObservationError.message);
    activeObservation = activeObservationRow
      ? activeObservationSummary(activeObservationRow.payload)
      : null;
  }

  let repositoryImportHistory: RepositoryImportHistoryItem[] = [];
  let repositorySnapshotHistory: readonly RepositorySnapshotHistoryItem[] = [];
  let repositoryScanHistory: readonly RepositoryScanHistoryItem[] = [];
  let repositoryScanLatestJob: RepositoryScanJobSummary | null = null;
  if (asset.kind === "repository") {
    const importRepository = createPhase3ImportRepository(supabase);
    const [importRows, snapshotRows, scanReadModel] = await Promise.all([
      importRepository.listRecentImports(workspace.id, asset.id, 20),
      listRepositorySnapshots(supabase, workspace.id, asset.id, 20),
      loadRepositoryScanReadModel(supabase, workspace.id, asset.id, 10),
    ]);
    repositoryImportHistory = importRows.map((row) => ({
      id: row.id,
      scanJobId: row.scan_job_id,
      runRef: row.run_ref,
      toolVersion: row.tool_version,
      scanStartedAt: row.scan_started_at,
      scanDurationMs: row.scan_duration_ms,
      scannerErrorCount: row.scanner_error_count,
      filesAnalyzed: row.files_analyzed,
      findingCount: row.finding_count,
      createdAt: row.created_at,
    }));
    repositorySnapshotHistory = snapshotRows;
    repositoryScanHistory = scanReadModel.history;
    repositoryScanLatestJob = scanReadModel.latestJob;
  }

  const isVerified = asset.verification_status === "verified";
  const jobSummary = latestJob ? {
    id: latestJob.id,
    status: latestJob.status,
    blockedReason: latestJob.blocked_reason,
    failureCode: latestJob.failure_code,
    requestCount: latestJob.request_count,
    redirectCount: latestJob.redirect_count,
    findingCount: latestJob.finding_count,
    cancelRequestedAt: latestJob.cancel_requested_at,
  } : null;
  const activeJobSummary = latestActiveJob ? {
    id: latestActiveJob.id,
    status: latestActiveJob.status,
    blockedReason: latestActiveJob.blocked_reason,
    failureCode: latestActiveJob.failure_code,
    requestCount: latestActiveJob.request_count,
    findingCount: latestActiveJob.finding_count,
    cancelRequestedAt: latestActiveJob.cancel_requested_at,
  } : null;

  return (
    <AppShell displayName={displayName} workspaceName={workspace.name} role={role}>
      <Link className="backLink" href="/dashboard/assets"><ArrowLeft size={14} /> Assets</Link>
      <section className="pageHeader assetPageHeader">
        <div><span className="sectionEyebrow">Asset control</span><h1>{asset.name}</h1><p>{asset.canonical_target}</p></div>
        <span className={`controlBadge ${isVerified ? "verified" : "unverified"}`}>{isVerified ? <CircleCheck size={15} /> : <Clock3 size={15} />}{isVerified ? "Control verified" : asset.verification_status.replaceAll("_", " ")}</span>
      </section>

      <section className="assetDetailGrid">
        <article className="panel">
          <div className="panelTitle"><div><span>Control status</span><h2>Authorization boundary</h2></div></div>
          <dl className="detailList">
            <div><dt>Asset type</dt><dd>{asset.kind.replaceAll("_", " ")}</dd></div>
            <div><dt>Hostname</dt><dd>{asset.hostname ?? "Not applicable"}</dd></div>
            <div><dt>Verification</dt><dd>{asset.verification_status.replaceAll("_", " ")}</dd></div>
            <div><dt>Verified at</dt><dd>{asset.verified_at ? new Date(asset.verified_at).toLocaleString() : "Not yet verified"}</dd></div>
          </dl>
        </article>
        <article className="panel">
          <div className="panelTitle"><div><span>Security testing</span><h2>Separated execution boundaries</h2></div><Activity size={18} /></div>
          <div className="guardrail"><ShieldCheck size={17} /><p><strong>Passive and active authority remain separate.</strong> Passive observation collects bounded HTTPS/TLS metadata. The active CORS profile requires explicit owner/admin authorization for one fixed-origin GET. Crawling, fuzzing, authentication replay, exploit payloads, and destructive behavior remain disabled.</p></div>
        </article>
      </section>

      <section className="panel verificationSection">
        <VerificationPanel assetId={asset.id} status={asset.verification_status} kind={asset.kind} />
      </section>

      {asset.kind === "repository" && (
        <>
          <section className="panel verificationSection">
            <RepositorySnapshotPanel
              assetId={asset.id}
              role={role}
              history={repositorySnapshotHistory}
              runtimeAvailable={HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED}
            />
          </section>
          <section className="panel verificationSection">
            <RepositoryScanPanel
              latestJob={repositoryScanLatestJob}
              history={repositoryScanHistory}
            />
          </section>
          <section className="panel verificationSection">
            <RepositoryImportPanel
              assetId={asset.id}
              repositoryUrl={asset.canonical_target}
              history={repositoryImportHistory}
            />
          </section>
        </>
      )}

      <section className="panel verificationSection">
        <RuntimeObservationPanel
          assetId={asset.id}
          assetKind={asset.kind}
          verificationStatus={asset.verification_status}
          latestJob={jobSummary}
          observations={observations}
        />
      </section>

      <section className="panel verificationSection">
        <ActiveValidationPanel
          assetId={asset.id}
          assetKind={asset.kind}
          verificationStatus={asset.verification_status}
          role={role}
          latestJob={activeJobSummary}
          observation={activeObservation}
        />
      </section>

      <section className="panel assetPanel">
        <div className="panelTitle"><div><span>Audit activity</span><h2>Recent security-control events</h2></div><FileClock size={18} /></div>
        {!events?.length ? <div className="emptyCompact">No asset audit events have been recorded yet.</div> : <div className="auditList">
          {events.map((event) => <div className="auditRow" key={event.id}><span className="auditDot" /><div><strong>{event.event_type.replaceAll(".", " ")}</strong><small>{new Date(event.created_at).toLocaleString()}</small></div></div>)}
        </div>}
      </section>
    </AppShell>
  );
}
