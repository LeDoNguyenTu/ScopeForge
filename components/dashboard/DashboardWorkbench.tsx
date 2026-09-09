"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Search, ShieldCheck } from "lucide-react";
import type { AttackSurfaceAssetInput } from "@/lib/dashboard/attack-surface-model";
import type { SecuritySeverity } from "@/lib/database.types";

export interface DashboardFinding {
  finding_id: string;
  title: string;
  asset_id: string;
  severity: SecuritySeverity;
  lifecycle_state: string;
  last_seen_at: string;
}
const ranks = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };

export default function DashboardWorkbench({ assets, findings, totalFindings }: {
  assets: readonly AttackSurfaceAssetInput[];
  findings: readonly DashboardFinding[];
  totalFindings: number;
}) {
  const [tab, setTab] = useState<"findings" | "assets">("findings");
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState("all");
  const [verification, setVerification] = useState("all");
  const [order, setOrder] = useState("priority");
  const [page, setPage] = useState(1);
  const term = query.trim().toLowerCase();
  const names = new Map(assets.map(asset => [asset.id, asset.name]));
  const filteredFindings = findings.filter(finding =>
    (severity === "all" || finding.severity === severity) &&
    `${finding.title} ${names.get(finding.asset_id) ?? ""}`.toLowerCase().includes(term)
  ).sort((a, b) => order === "recent"
    ? b.last_seen_at.localeCompare(a.last_seen_at)
    : ranks[b.severity] - ranks[a.severity] || b.last_seen_at.localeCompare(a.last_seen_at));
  const filteredAssets = assets.filter(asset =>
    (verification === "all" || (verification === "verified" ? asset.verification_status === "verified" : asset.verification_status !== "verified")) &&
    `${asset.name} ${asset.canonical_target} ${asset.kind}`.toLowerCase().includes(term));
  const count = tab === "findings" ? filteredFindings.length : filteredAssets.length;
  const pageCount = Math.max(1, Math.ceil(count / 6));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * 6;
  const hasFilters = Boolean(term) || (tab === "findings" ? severity !== "all" : verification !== "all");

  return (
    <section className="saasWorkbench" aria-label="Workspace work queue">
      <div className="saasQueueHeading"><div><span className="saasEyebrow">YOUR WORKSPACE</span><h2>What needs your attention</h2></div><Link href={tab === "findings" ? "/dashboard/findings" : "/dashboard/assets"}>View all <ArrowRight size={14} /></Link></div>
      <div className="saasQueueTabs" aria-label="Work queue view">
        <button type="button" aria-pressed={tab === "findings"} onClick={() => { setTab("findings"); setPage(1); }}>Findings <span>{totalFindings}</span></button>
        <button type="button" aria-pressed={tab === "assets"} onClick={() => { setTab("assets"); setPage(1); }}>Assets <span>{assets.length}</span></button>
      </div>
      <div className="saasQueueFilters">
        <label className="saasSearch"><Search size={16} /><span className="srOnly">Search work queue</span><input placeholder={tab === "findings" ? "Search findings or assets…" : "Search name, target, or kind…"} value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} /></label>
        {tab === "findings" ? <>
          <label><span className="srOnly">Severity</span><select aria-label="Severity" value={severity} onChange={e => { setSeverity(e.target.value); setPage(1); }}><option value="all">All severities</option>{Object.keys(ranks).map(value => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select></label>
          <label><span className="srOnly">Sort findings</span><select aria-label="Sort findings" value={order} onChange={e => { setOrder(e.target.value); setPage(1); }}><option value="priority">Highest priority</option><option value="recent">Most recent</option></select></label>
        </> : <label><span className="srOnly">Verification</span><select aria-label="Verification" value={verification} onChange={e => { setVerification(e.target.value); setPage(1); }}><option value="all">All assets</option><option value="verified">Verified</option><option value="pending">Needs verification</option></select></label>}
      </div>
      {count === 0 ? <div className="saasQueueEmpty"><ShieldCheck size={28} /><h3>{hasFilters ? "No matching results" : tab === "findings" ? "No findings to review yet" : "Build your asset inventory"}</h3><p>{hasFilters ? "Try a different search or clear your filters." : tab === "findings" ? "Findings appear here when a supported security workflow reports evidence. Start by verifying your assets." : "Register an application, API, or repository that you control."}</p>{hasFilters ? <button type="button" className="saasClearFilters" onClick={() => { setQuery(""); setSeverity("all"); setVerification("all"); setPage(1); }}>Clear filters</button> : <Link href="/dashboard/assets/new">Register an asset <ArrowRight size={14} /></Link>}</div> : <div className="saasQueueTable">
        <div className="saasQueueColumns" aria-hidden="true"><span>{tab === "findings" ? "Finding / asset" : "Asset / target"}</span><span>{tab === "findings" ? "Severity" : "Kind"}</span><span>{tab === "findings" ? "Status" : "Verification"}</span><span /></div>
        {tab === "findings" ? filteredFindings.slice(start, start + 6).map(finding => <Link className="saasQueueRow" key={finding.finding_id} href={`/dashboard/findings/${encodeURIComponent(finding.finding_id)}`}><div><strong>{finding.title}</strong><small>{names.get(finding.asset_id) ?? "Workspace asset"}</small></div><span className={`saasSeverity saasSeverity-${finding.severity}`}>{finding.severity}</span><span className="saasRowStatus">{finding.lifecycle_state.replaceAll("_", " ")}</span><ArrowRight size={15} /></Link>) : filteredAssets.slice(start, start + 6).map(asset => <Link className="saasQueueRow" key={asset.id} href={`/dashboard/assets/${asset.id}`}><div><strong>{asset.name}</strong><small>{asset.canonical_target}</small></div><span className="saasRowKind">{asset.kind.replaceAll("_", " ")}</span><span className={`saasVerification ${asset.verification_status === "verified" ? "isVerified" : ""}`}>{asset.verification_status === "verified" ? "Verified" : "Needs verification"}</span><ArrowRight size={15} /></Link>)}
      </div>}
      <div className="saasQueueFooter"><span role="status">{count === 0 ? "0 results" : `${start + 1}–${Math.min(start + 6, count)} of ${count} results`}{tab === "findings" && totalFindings > findings.length ? ` · Latest ${findings.length} of ${totalFindings} loaded` : ""}</span><div><button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button><button type="button" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Next</button></div></div>
    </section>
  );
}
