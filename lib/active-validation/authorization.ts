import type {
  Database,
  Json,
  WorkspaceRole,
} from "@/lib/database.types";
import type { EnqueueActiveValidationJobInput } from "./types";
import { assetRef } from "@/packages/security-domain";
import {
  ACTIVE_VALIDATION_MAX_BUDGET,
  CORS_ORIGIN_POLICY_PROFILE,
  validateActiveValidationBudget,
  validateCorsOriginPolicyTarget,
  type ActiveValidationBudget,
  type AuthorizedValidationTarget,
} from "@/packages/runtime-validator";

type AssetRow = Database["public"]["Tables"]["assets"]["Row"];
type ScanJobRow = Database["public"]["Tables"]["scan_jobs"]["Row"];

export type ActiveValidationAuthorizationCode =
  | "ACTIVE_UNAUTHENTICATED"
  | "ACTIVE_WORKSPACE_DENIED"
  | "ACTIVE_EXPLICIT_AUTHORIZATION_REQUIRED"
  | "ACTIVE_ASSET_NOT_AVAILABLE"
  | "ACTIVE_ASSET_UNSUPPORTED"
  | "ACTIVE_ASSET_UNVERIFIED"
  | "ACTIVE_AUTHORIZATION_CHANGED"
  | "ACTIVE_PROFILE_INVALID"
  | "ACTIVE_CANCELLATION_REQUESTED"
  | "ACTIVE_JOB_NOT_AVAILABLE"
  | "ACTIVE_JOB_NOT_EXECUTABLE"
  | "ACTIVE_BUDGET_INVALID";

const SAFE_REASONS: Readonly<Record<ActiveValidationAuthorizationCode, string>> = Object.freeze({
  ACTIVE_UNAUTHENTICATED: "Sign in before running bounded active validation.",
  ACTIVE_WORKSPACE_DENIED: "Only workspace owners and admins can authorize bounded active validation.",
  ACTIVE_EXPLICIT_AUTHORIZATION_REQUIRED: "Explicit active-validation authorization is required for this run.",
  ACTIVE_ASSET_NOT_AVAILABLE: "The selected asset is not available in this workspace.",
  ACTIVE_ASSET_UNSUPPORTED: "Bounded active validation supports verified web and API assets only.",
  ACTIVE_ASSET_UNVERIFIED: "Verify the asset before authorizing bounded active validation.",
  ACTIVE_AUTHORIZATION_CHANGED: "The asset authorization snapshot changed after this active job was queued.",
  ACTIVE_PROFILE_INVALID: "The active validation profile does not match the approved built-in profile.",
  ACTIVE_CANCELLATION_REQUESTED: "Cancellation was requested before active network activity started.",
  ACTIVE_JOB_NOT_AVAILABLE: "The active validation job is not available in this workspace.",
  ACTIVE_JOB_NOT_EXECUTABLE: "The active validation job is not executable in its current state.",
  ACTIVE_BUDGET_INVALID: "The active validation budget is invalid.",
});

export class ActiveValidationAuthorizationError extends Error {
  readonly code: ActiveValidationAuthorizationCode;
  readonly reason: string;

  constructor(code: ActiveValidationAuthorizationCode) {
    super(SAFE_REASONS[code]);
    this.name = "ActiveValidationAuthorizationError";
    this.code = code;
    this.reason = SAFE_REASONS[code];
  }
}

function fail(code: ActiveValidationAuthorizationCode): never {
  throw new ActiveValidationAuthorizationError(code);
}

function canAuthorizeActiveValidation(role: WorkspaceRole | null): role is "owner" | "admin" {
  return role === "owner" || role === "admin";
}

function assertActor(actorId: string | null, role: WorkspaceRole | null): asserts actorId is string {
  if (!actorId) fail("ACTIVE_UNAUTHENTICATED");
  if (!canAuthorizeActiveValidation(role)) fail("ACTIVE_WORKSPACE_DENIED");
}

function isRuntimeAssetKind(kind: AssetRow["kind"]): kind is "web_application" | "api" {
  return kind === "web_application" || kind === "api";
}

function assertAssetAvailable(
  asset: AssetRow | null,
  workspaceId: string,
  assetId?: string,
): asserts asset is AssetRow {
  if (!asset || asset.workspace_id !== workspaceId || (assetId !== undefined && asset.id !== assetId)) {
    fail("ACTIVE_ASSET_NOT_AVAILABLE");
  }
}

function assertVerifiedRuntimeAsset(asset: AssetRow): asserts asset is AssetRow & {
  kind: "web_application" | "api";
  verified_at: string;
  hostname: string;
} {
  if (!isRuntimeAssetKind(asset.kind)) fail("ACTIVE_ASSET_UNSUPPORTED");
  if (asset.verification_status !== "verified" || !asset.verified_at) {
    fail("ACTIVE_ASSET_UNVERIFIED");
  }
  if (!asset.hostname) fail("ACTIVE_AUTHORIZATION_CHANGED");
}

function targetFromAsset(asset: AssetRow & {
  kind: "web_application" | "api";
  hostname: string;
}): AuthorizedValidationTarget {
  const target: AuthorizedValidationTarget = Object.freeze({
    assetRef: assetRef(asset.id),
    kind: asset.kind,
    canonicalUrl: asset.canonical_target,
    hostname: asset.hostname,
  });
  try {
    validateCorsOriginPolicyTarget(target);
  } catch {
    fail("ACTIVE_AUTHORIZATION_CHANGED");
  }
  return target;
}

function exactApprovedBudget(input: ActiveValidationBudget): Readonly<ActiveValidationBudget> {
  let budget: Readonly<ActiveValidationBudget>;
  try {
    budget = validateActiveValidationBudget(input);
  } catch {
    fail("ACTIVE_BUDGET_INVALID");
  }
  for (const key of Object.keys(ACTIVE_VALIDATION_MAX_BUDGET) as (keyof ActiveValidationBudget)[]) {
    if (budget[key] !== ACTIVE_VALIDATION_MAX_BUDGET[key]) fail("ACTIVE_BUDGET_INVALID");
  }
  return budget;
}

function parsePersistedBudget(value: Json): Readonly<ActiveValidationBudget> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("ACTIVE_BUDGET_INVALID");
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
    if (typeof record[key] !== "number") fail("ACTIVE_BUDGET_INVALID");
  }
  return exactApprovedBudget({
    maxRequests: record.maxRequests as number,
    maxRedirects: record.maxRedirects as number,
    perRequestTimeoutMs: record.perRequestTimeoutMs as number,
    totalTimeoutMs: record.totalTimeoutMs as number,
    maxObservationBytes: record.maxObservationBytes as number,
  });
}

export interface ActiveValidationEnqueueAuthorizationInput {
  actorId: string | null;
  workspaceId: string;
  role: WorkspaceRole | null;
  asset: AssetRow | null;
  explicitConsent: boolean;
  authorizationGrantedAt: string;
  budget: ActiveValidationBudget;
}

export function authorizeActiveValidationEnqueue(
  input: ActiveValidationEnqueueAuthorizationInput,
): Readonly<{
  enqueueInput: EnqueueActiveValidationJobInput;
  target: AuthorizedValidationTarget;
}> {
  assertActor(input.actorId, input.role);
  if (input.explicitConsent !== true) fail("ACTIVE_EXPLICIT_AUTHORIZATION_REQUIRED");
  assertAssetAvailable(input.asset, input.workspaceId);
  assertVerifiedRuntimeAsset(input.asset);
  if (!Number.isFinite(Date.parse(input.authorizationGrantedAt))) {
    fail("ACTIVE_AUTHORIZATION_CHANGED");
  }
  const budget = exactApprovedBudget(input.budget);
  const target = targetFromAsset(input.asset);

  return Object.freeze({
    enqueueInput: Object.freeze({
      workspaceId: input.workspaceId,
      assetId: input.asset.id,
      requestedBy: input.actorId,
      canonicalTarget: input.asset.canonical_target,
      assetKind: input.asset.kind,
      verifiedAt: input.asset.verified_at,
      profileId: CORS_ORIGIN_POLICY_PROFILE.id,
      profileVersion: CORS_ORIGIN_POLICY_PROFILE.version,
      authorizationGrantedAt: input.authorizationGrantedAt,
      budget,
    }),
    target,
  });
}

export function reauthorizeActiveValidationExecution(input: {
  job: ScanJobRow;
  asset: AssetRow | null;
}): Readonly<{
  target: AuthorizedValidationTarget;
  budget: Readonly<ActiveValidationBudget>;
}> {
  const { job } = input;
  if (job.job_kind !== "active_validation" || job.status !== "queued") {
    fail("ACTIVE_JOB_NOT_EXECUTABLE");
  }
  if (job.cancel_requested_at) fail("ACTIVE_CANCELLATION_REQUESTED");
  if (
    job.validation_profile_id !== CORS_ORIGIN_POLICY_PROFILE.id
    || job.validation_profile_version !== CORS_ORIGIN_POLICY_PROFILE.version
    || !job.authorization_granted_at
  ) {
    fail("ACTIVE_PROFILE_INVALID");
  }

  assertAssetAvailable(input.asset, job.workspace_id, job.asset_id);
  assertVerifiedRuntimeAsset(input.asset);
  if (
    job.authorization_canonical_target === null
    || job.authorization_asset_kind === null
    || job.authorization_verified_at === null
    || !isRuntimeAssetKind(job.authorization_asset_kind)
  ) {
    fail("ACTIVE_AUTHORIZATION_CHANGED");
  }
  if (
    input.asset.canonical_target !== job.authorization_canonical_target
    || input.asset.kind !== job.authorization_asset_kind
    || input.asset.verified_at !== job.authorization_verified_at
  ) {
    fail("ACTIVE_AUTHORIZATION_CHANGED");
  }

  return Object.freeze({
    target: targetFromAsset(input.asset),
    budget: parsePersistedBudget(job.budget),
  });
}

export function assertActiveValidationOperator(input: {
  actorId: string | null;
  role: WorkspaceRole | null;
}): asserts input is { actorId: string; role: "owner" | "admin" } {
  assertActor(input.actorId, input.role);
}
