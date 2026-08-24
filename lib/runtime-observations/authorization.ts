import type {
  Database,
  Json,
  WorkspaceRole,
} from "@/lib/database.types";
import type { EnqueueRuntimeObservationJobInput } from "./types";
import { assetRef } from "@/packages/security-domain";
import {
  validateInitialRuntimeUrl,
  validateRuntimeObservationBudget,
  type AuthorizedRuntimeTarget,
  type RuntimeObservationBudget,
} from "@/packages/runtime-observer";

type AssetRow = Database["public"]["Tables"]["assets"]["Row"];
type ScanJobRow = Database["public"]["Tables"]["scan_jobs"]["Row"];

export type RuntimeAuthorizationCode =
  | "RUNTIME_UNAUTHENTICATED"
  | "RUNTIME_WORKSPACE_DENIED"
  | "RUNTIME_ASSET_NOT_AVAILABLE"
  | "RUNTIME_ASSET_UNSUPPORTED"
  | "RUNTIME_ASSET_UNVERIFIED"
  | "RUNTIME_AUTHORIZATION_CHANGED"
  | "RUNTIME_CANCELLATION_REQUESTED"
  | "RUNTIME_JOB_NOT_AVAILABLE"
  | "RUNTIME_JOB_NOT_EXECUTABLE"
  | "RUNTIME_BUDGET_INVALID";

const SAFE_REASONS: Readonly<Record<RuntimeAuthorizationCode, string>> = Object.freeze({
  RUNTIME_UNAUTHENTICATED: "Sign in before running a passive observation.",
  RUNTIME_WORKSPACE_DENIED: "Your workspace role cannot run passive observations.",
  RUNTIME_ASSET_NOT_AVAILABLE: "The selected asset is not available in this workspace.",
  RUNTIME_ASSET_UNSUPPORTED: "Passive observations support verified web and API assets only.",
  RUNTIME_ASSET_UNVERIFIED: "Verify the asset before running another passive observation.",
  RUNTIME_AUTHORIZATION_CHANGED: "The asset authorization snapshot changed after this job was queued.",
  RUNTIME_CANCELLATION_REQUESTED: "Cancellation was requested before network activity started.",
  RUNTIME_JOB_NOT_AVAILABLE: "The passive observation job is not available in this workspace.",
  RUNTIME_JOB_NOT_EXECUTABLE: "The passive observation job is not executable in its current state.",
  RUNTIME_BUDGET_INVALID: "The passive observation budget is invalid.",
});

export class RuntimeAuthorizationError extends Error {
  readonly code: RuntimeAuthorizationCode;
  readonly reason: string;

  constructor(code: RuntimeAuthorizationCode) {
    super(SAFE_REASONS[code]);
    this.name = "RuntimeAuthorizationError";
    this.code = code;
    this.reason = SAFE_REASONS[code];
  }
}

function fail(code: RuntimeAuthorizationCode): never {
  throw new RuntimeAuthorizationError(code);
}

function canRunRuntimeObservation(role: WorkspaceRole | null): boolean {
  return role === "owner" || role === "admin" || role === "member";
}

function assertActor(actorId: string | null, role: WorkspaceRole | null): asserts actorId is string {
  if (!actorId) fail("RUNTIME_UNAUTHENTICATED");
  if (!canRunRuntimeObservation(role)) fail("RUNTIME_WORKSPACE_DENIED");
}

function isRuntimeAssetKind(kind: AssetRow["kind"]): kind is "web_application" | "api" {
  return kind === "web_application" || kind === "api";
}

function assertAssetAvailable(asset: AssetRow | null, workspaceId: string, assetId?: string): asserts asset is AssetRow {
  if (!asset || asset.workspace_id !== workspaceId || (assetId !== undefined && asset.id !== assetId)) {
    fail("RUNTIME_ASSET_NOT_AVAILABLE");
  }
}

function assertVerifiedRuntimeAsset(asset: AssetRow): asserts asset is AssetRow & {
  kind: "web_application" | "api";
  verified_at: string;
  hostname: string;
} {
  if (!isRuntimeAssetKind(asset.kind)) fail("RUNTIME_ASSET_UNSUPPORTED");
  if (asset.verification_status !== "verified" || !asset.verified_at) {
    fail("RUNTIME_ASSET_UNVERIFIED");
  }
  if (!asset.hostname) fail("RUNTIME_AUTHORIZATION_CHANGED");
}

function targetFromAsset(asset: AssetRow & {
  kind: "web_application" | "api";
  hostname: string;
}): AuthorizedRuntimeTarget {
  const target: AuthorizedRuntimeTarget = Object.freeze({
    assetRef: assetRef(asset.id),
    kind: asset.kind,
    canonicalUrl: asset.canonical_target,
    hostname: asset.hostname,
  });

  try {
    validateInitialRuntimeUrl(target);
  } catch {
    fail("RUNTIME_AUTHORIZATION_CHANGED");
  }
  return target;
}

function parsePersistedBudget(value: Json): Readonly<RuntimeObservationBudget> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("RUNTIME_BUDGET_INVALID");
  }

  const record = value as Record<string, Json | undefined>;
  const keys = [
    "maxRequests",
    "maxRedirects",
    "perRequestTimeoutMs",
    "totalTimeoutMs",
    "maxObservationBytes",
  ] as const;

  for (const key of keys) {
    if (typeof record[key] !== "number") fail("RUNTIME_BUDGET_INVALID");
  }

  try {
    return validateRuntimeObservationBudget({
      maxRequests: record.maxRequests as number,
      maxRedirects: record.maxRedirects as number,
      perRequestTimeoutMs: record.perRequestTimeoutMs as number,
      totalTimeoutMs: record.totalTimeoutMs as number,
      maxObservationBytes: record.maxObservationBytes as number,
    });
  } catch {
    fail("RUNTIME_BUDGET_INVALID");
  }
}

export interface RuntimeObservationEnqueueAuthorizationInput {
  actorId: string | null;
  workspaceId: string;
  role: WorkspaceRole | null;
  asset: AssetRow | null;
  budget: RuntimeObservationBudget;
}

export interface AuthorizedRuntimeObservationEnqueue {
  enqueueInput: EnqueueRuntimeObservationJobInput;
  target: AuthorizedRuntimeTarget;
}

export function authorizeRuntimeObservationEnqueue(
  input: RuntimeObservationEnqueueAuthorizationInput,
): AuthorizedRuntimeObservationEnqueue {
  assertActor(input.actorId, input.role);
  assertAssetAvailable(input.asset, input.workspaceId);
  assertVerifiedRuntimeAsset(input.asset);

  let budget: Readonly<RuntimeObservationBudget>;
  try {
    budget = validateRuntimeObservationBudget(input.budget);
  } catch {
    fail("RUNTIME_BUDGET_INVALID");
  }

  const target = targetFromAsset(input.asset);
  return Object.freeze({
    enqueueInput: Object.freeze({
      workspaceId: input.workspaceId,
      assetId: input.asset.id,
      requestedBy: input.actorId,
      canonicalTarget: input.asset.canonical_target,
      assetKind: input.asset.kind,
      verifiedAt: input.asset.verified_at,
      budget,
    }),
    target,
  });
}

export interface RuntimeObservationExecutionAuthorizationInput {
  job: ScanJobRow;
  asset: AssetRow | null;
}

export interface AuthorizedRuntimeObservationExecution {
  target: AuthorizedRuntimeTarget;
  budget: Readonly<RuntimeObservationBudget>;
}

export function reauthorizeRuntimeObservationExecution(
  input: RuntimeObservationExecutionAuthorizationInput,
): AuthorizedRuntimeObservationExecution {
  const { job } = input;
  if (job.job_kind !== "passive_runtime" || job.status !== "queued") {
    fail("RUNTIME_JOB_NOT_EXECUTABLE");
  }
  if (job.cancel_requested_at) fail("RUNTIME_CANCELLATION_REQUESTED");

  assertAssetAvailable(input.asset, job.workspace_id, job.asset_id);
  assertVerifiedRuntimeAsset(input.asset);

  if (
    job.authorization_canonical_target === null
    || job.authorization_asset_kind === null
    || job.authorization_verified_at === null
    || !isRuntimeAssetKind(job.authorization_asset_kind)
  ) {
    fail("RUNTIME_AUTHORIZATION_CHANGED");
  }

  if (
    input.asset.canonical_target !== job.authorization_canonical_target
    || input.asset.kind !== job.authorization_asset_kind
    || input.asset.verified_at !== job.authorization_verified_at
  ) {
    fail("RUNTIME_AUTHORIZATION_CHANGED");
  }

  const target = targetFromAsset(input.asset);
  const budget = parsePersistedBudget(job.budget);
  return Object.freeze({ target, budget });
}

export function assertRuntimeObservationOperator(input: {
  actorId: string | null;
  role: WorkspaceRole | null;
}): asserts input is { actorId: string; role: Exclude<WorkspaceRole, "viewer"> } {
  assertActor(input.actorId, input.role);
}
