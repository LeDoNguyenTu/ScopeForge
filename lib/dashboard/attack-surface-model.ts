import type {
  AssetKind,
  AssetVerificationStatus,
  FindingLifecycleState,
  SecuritySeverity,
} from "@/lib/database.types";

export type AttackSurfaceNodeState = "healthy" | "pending" | "risk";

export interface AttackSurfaceAssetInput {
  id: string;
  kind: AssetKind;
  name: string;
  canonical_target: string;
  verification_status: AssetVerificationStatus;
  created_at: string;
}

export interface AttackSurfaceFindingInput {
  asset_id: string;
  severity: SecuritySeverity;
  title: string;
  lifecycle_state: Extract<
    FindingLifecycleState,
    "open" | "acknowledged" | "in_progress" | "resolved" | "retest_pending"
  >;
}

export interface AttackSurfaceNode {
  id: string;
  kind: AssetKind;
  label: string;
  canonicalTarget: string;
  verificationStatus: AssetVerificationStatus;
  state: AttackSurfaceNodeState;
  severity: SecuritySeverity | null;
  findingCount: number;
  angle: number;
  radius: number;
}

export interface AttackSurfaceMetrics {
  registeredAssets: number;
  verifiedAssets: number;
  openFindings: number;
  verificationPercent: number;
  affectedAssets: number;
}

export interface AttackSurfacePriority {
  assetId: string;
  assetName: string;
  severity: SecuritySeverity;
  title: string;
}

export interface AttackSurfaceModel {
  nodes: readonly AttackSurfaceNode[];
  metrics: AttackSurfaceMetrics;
  priority: AttackSurfacePriority | null;
}

const severityRank: Readonly<Record<SecuritySeverity, number>> = Object.freeze({
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
});

const stateRank: Readonly<Record<AttackSurfaceNodeState, number>> = Object.freeze({
  healthy: 0,
  pending: 1,
  risk: 2,
});

const visualAngles = [-152, -118, -82, -46, -10, 28, 65, 101, 137, 173] as const;
const visualRadii = [0.82, 0.74, 0.86, 0.78, 0.9, 0.75, 0.84, 0.77, 0.88, 0.8] as const;

function stableAssetOrder(a: AttackSurfaceAssetInput, b: AttackSurfaceAssetInput): number {
  const byCreated = a.created_at.localeCompare(b.created_at);
  return byCreated === 0 ? a.id.localeCompare(b.id) : byCreated;
}

function stableFindingOrder(a: AttackSurfaceFindingInput, b: AttackSurfaceFindingInput): number {
  const severityDelta = severityRank[b.severity] - severityRank[a.severity];
  if (severityDelta !== 0) return severityDelta;
  const byTitle = a.title.localeCompare(b.title);
  return byTitle === 0 ? a.asset_id.localeCompare(b.asset_id) : byTitle;
}

function stateForAsset(
  asset: AttackSurfaceAssetInput,
  findings: readonly AttackSurfaceFindingInput[],
): AttackSurfaceNodeState {
  if (findings.length > 0) return "risk";
  return asset.verification_status === "verified" ? "healthy" : "pending";
}

export function buildAttackSurfaceModel({
  assets,
  findings,
  openFindingCount,
}: {
  assets: readonly AttackSurfaceAssetInput[];
  findings: readonly AttackSurfaceFindingInput[];
  openFindingCount?: number;
}): AttackSurfaceModel {
  const sortedAssets = [...assets].sort(stableAssetOrder);
  const assetIds = new Set(sortedAssets.map((asset) => asset.id));
  const findingsByAsset = new Map<string, AttackSurfaceFindingInput[]>();

  for (const finding of findings) {
    if (!assetIds.has(finding.asset_id)) continue;
    const current = findingsByAsset.get(finding.asset_id) ?? [];
    current.push(finding);
    findingsByAsset.set(finding.asset_id, current);
  }

  for (const assetFindings of findingsByAsset.values()) {
    assetFindings.sort(stableFindingOrder);
  }

  const candidates = sortedAssets.map((asset): AttackSurfaceNode => {
    const assetFindings = findingsByAsset.get(asset.id) ?? [];
    const highest = assetFindings[0] ?? null;

    return Object.freeze({
      id: asset.id,
      kind: asset.kind,
      label: asset.name,
      canonicalTarget: asset.canonical_target,
      verificationStatus: asset.verification_status,
      state: stateForAsset(asset, assetFindings),
      severity: highest?.severity ?? null,
      findingCount: assetFindings.length,
      angle: 0,
      radius: 0,
    });
  });

  const candidateOrder = new Map(candidates.map((node, index) => [node.id, index]));
  const visualNodes = [...candidates]
    .sort((a, b) => {
      const stateDelta = stateRank[b.state] - stateRank[a.state];
      if (stateDelta !== 0) return stateDelta;
      const severityDelta = severityRank[b.severity ?? "info"] - severityRank[a.severity ?? "info"];
      if (severityDelta !== 0) return severityDelta;
      if (b.findingCount !== a.findingCount) return b.findingCount - a.findingCount;
      return (candidateOrder.get(a.id) ?? 0) - (candidateOrder.get(b.id) ?? 0);
    })
    .slice(0, visualAngles.length)
    .map((node, index) => Object.freeze({
      ...node,
      angle: visualAngles[index],
      radius: visualRadii[index],
    }));

  const priorityNode = [...candidates]
    .filter((node) => node.severity !== null)
    .sort((a, b) => {
      const severityDelta = severityRank[b.severity!] - severityRank[a.severity!];
      if (severityDelta !== 0) return severityDelta;
      if (b.findingCount !== a.findingCount) return b.findingCount - a.findingCount;
      return a.label.localeCompare(b.label);
    })[0] ?? null;

  const priorityFinding = priorityNode
    ? (findingsByAsset.get(priorityNode.id) ?? [])[0] ?? null
    : null;

  const registeredAssets = sortedAssets.length;
  const verifiedAssets = sortedAssets.filter((asset) => asset.verification_status === "verified").length;
  const sampledFindingCount = findings.filter((finding) => assetIds.has(finding.asset_id)).length;
  const metrics: AttackSurfaceMetrics = Object.freeze({
    registeredAssets,
    verifiedAssets,
    openFindings: typeof openFindingCount === "number"
      ? Math.max(0, Math.trunc(openFindingCount))
      : sampledFindingCount,
    verificationPercent: registeredAssets === 0
      ? 0
      : Math.round((verifiedAssets / registeredAssets) * 100),
    affectedAssets: findingsByAsset.size,
  });

  return Object.freeze({
    nodes: Object.freeze(visualNodes),
    metrics,
    priority: priorityNode && priorityFinding
      ? Object.freeze({
        assetId: priorityNode.id,
        assetName: priorityNode.label,
        severity: priorityFinding.severity,
        title: priorityFinding.title,
      })
      : null,
  });
}
