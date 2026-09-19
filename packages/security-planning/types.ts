export type ExecutionMode = "passive" | "safe_active" | "intrusive" | "validation";

export type AssetNodeType =
  | "repository"
  | "domain"
  | "hostname"
  | "ip_endpoint"
  | "http_service"
  | "api"
  | "api_operation"
  | "cloud_account"
  | "cloud_resource"
  | "container_image"
  | "kubernetes_workload"
  | "mobile_application"
  | "identity";

export type PrimitiveFact = string | number | boolean;
export type PrimitiveFacts = Readonly<Record<string, PrimitiveFact>>;

export interface AssetNode {
  assetNodeId: string;
  assetType: AssetNodeType;
  canonicalLocator: string;
  parentNodeIds: readonly string[];
  authorizationRef: string;
  technologyTags: readonly string[];
  confidence: number;
  provenanceRefs: readonly string[];
}

export interface Observation {
  observationId: string;
  runId: string;
  providerId: string;
  providerVersion: string;
  capabilityId: string;
  assetNodeIds: readonly string[];
  evidenceRefs: readonly string[];
  facts: PrimitiveFacts;
  observedAt: string;
  confidence: number;
  authorizationSnapshotRef: string;
  executionMode: ExecutionMode;
}

export type HypothesisStatus =
  | "proposed"
  | "eligible"
  | "blocked"
  | "testing"
  | "supported"
  | "refuted"
  | "exhausted";

export interface Hypothesis {
  hypothesisId: string;
  reasoningSource: string;
  targetNodeIds: readonly string[];
  statement: string;
  preconditions: readonly string[];
  candidateCapabilityIds: readonly string[];
  expectedEvidenceTypes: readonly string[];
  baseConfidence: number;
  confidence: number;
  status: HypothesisStatus;
  evidenceRefs: readonly string[];
}

export type StateMutationClass = "none" | "bounded" | "state_changing";

export interface CapabilityDescriptor {
  capabilityId: string;
  version: string;
  supportedAssetTypes: readonly AssetNodeType[];
  requiredObservationTypes: readonly string[];
  mode: ExecutionMode;
  expectedEffects: readonly string[];
  evidenceTypes: readonly string[];
  maxRequestBudget: number;
  maxRuntimeMs: number;
  stateMutationClass: StateMutationClass;
  credentialClasses: readonly string[];
  sessionClasses: readonly string[];
  cleanupRequired: boolean;
  providerIds: readonly string[];
  closedParameters?: PrimitiveFacts;
}

export interface ActionIntent {
  actionId: string;
  hypothesisId: string;
  capabilityId: string;
  targetNodeIds: readonly string[];
  requestedMode: ExecutionMode;
  closedParameters: PrimitiveFacts;
  expectedEvidenceTypes: readonly string[];
  requestedCredentialClass?: string;
  requestedSessionClass?: string;
}

export interface ActionAuthorization {
  authorizationId: string;
  actionId: string;
  workspaceId: string;
  targetNodeIds: readonly string[];
  authorizationSnapshotRef: string;
  capabilityId: string;
  capabilityVersion: string;
  executionMode: ExecutionMode;
  maxRequests: number;
  maxRuntimeMs: number;
  expiresAt: string;
  cancellationKey: string;
}

export type ActionResultStatus =
  | "succeeded"
  | "no_signal"
  | "blocked"
  | "cancelled"
  | "timed_out"
  | "provider_failed"
  | "policy_rejected";

export interface ActionResult {
  actionId: string;
  authorizationId: string;
  providerId: string;
  providerVersion: string;
  status: ActionResultStatus;
  observationIds: readonly string[];
  evidenceRefs: readonly string[];
  startedAt: string;
  completedAt: string;
  errorCode?: string;
}

export interface CoverageState {
  attemptedCapabilityIds: readonly string[];
  coveredNodeIds: readonly string[];
  untestedNodeIds: readonly string[];
  requestCount: number;
  graphExpansionCount: number;
  providerFailureCount: number;
  startedAt: string;
  deadlineAt: string;
}

export type RunStopReason =
  | "cancelled"
  | "deadline_reached"
  | "request_budget_exhausted"
  | "graph_expansion_limit"
  | "provider_failure_limit"
  | "no_eligible_hypotheses"
  | "approval_required"
  | "authorization_expired"
  | "coverage_complete";

export type DomainConstructionErrorCode =
  | "INVALID_INPUT"
  | "UNKNOWN_FIELD"
  | "INVALID_IDENTIFIER"
  | "INVALID_MODE"
  | "INVALID_NUMBER"
  | "INVALID_ARRAY"
  | "INVALID_PARAMETERS"
  | "EVIDENCE_REQUIRED"
  | "AUTHORIZATION_EXPIRED";

export type DomainConstructionResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: DomainConstructionErrorCode; message: string } };

const EXECUTION_MODES = new Set<ExecutionMode>(["passive", "safe_active", "intrusive", "validation"]);
const ASSET_NODE_TYPES = new Set<AssetNodeType>([
  "repository",
  "domain",
  "hostname",
  "ip_endpoint",
  "http_service",
  "api",
  "api_operation",
  "cloud_account",
  "cloud_resource",
  "container_image",
  "kubernetes_workload",
  "mobile_application",
  "identity",
]);
const STATE_MUTATION_CLASSES = new Set<StateMutationClass>(["none", "bounded", "state_changing"]);

function failure(code: DomainConstructionErrorCode, message: string): DomainConstructionResult<never> {
  return { ok: false, error: { code, message } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unknownField(input: Record<string, unknown>, allowed: ReadonlySet<string>): string | null {
  return Object.keys(input).find((key) => !allowed.has(key)) ?? null;
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function stringArray(value: unknown, options: { nonEmpty?: boolean } = {}): readonly string[] | null {
  if (!Array.isArray(value)) return null;
  const normalized = value.map(nonEmptyString);
  if (normalized.some((item) => item === null)) return null;
  if (options.nonEmpty && normalized.length === 0) return null;
  return normalized as readonly string[];
}

function finiteNumber(value: unknown, minimum: number, maximum = Number.POSITIVE_INFINITY): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum
    ? value
    : null;
}

function positiveInteger(value: unknown, fallback?: number): number | null {
  const candidate = value === undefined ? fallback : value;
  return typeof candidate === "number" && Number.isInteger(candidate) && candidate > 0 ? candidate : null;
}

function executionMode(value: unknown): ExecutionMode | null {
  return typeof value === "string" && EXECUTION_MODES.has(value as ExecutionMode)
    ? value as ExecutionMode
    : null;
}

function primitiveFacts(value: unknown): PrimitiveFacts | null {
  if (!isRecord(value)) return null;
  for (const [key, fact] of Object.entries(value)) {
    if (key.trim().length === 0) return null;
    if (typeof fact !== "string" && typeof fact !== "number" && typeof fact !== "boolean") return null;
    if (typeof fact === "number" && !Number.isFinite(fact)) return null;
  }
  return Object.freeze({ ...value }) as PrimitiveFacts;
}

function isoDate(value: unknown): string | null {
  const date = value instanceof Date
    ? value
    : typeof value === "string"
      ? new Date(value)
      : null;
  if (!date || !Number.isFinite(date.getTime())) return null;
  return date.toISOString();
}

export function makeCapabilityDescriptor(input: unknown): DomainConstructionResult<CapabilityDescriptor> {
  if (!isRecord(input)) return failure("INVALID_INPUT", "Capability descriptor must be an object.");

  const allowed = new Set([
    "capabilityId",
    "version",
    "supportedAssetTypes",
    "requiredObservationTypes",
    "mode",
    "expectedEffects",
    "evidenceTypes",
    "maxRequestBudget",
    "maxRuntimeMs",
    "stateMutationClass",
    "credentialClasses",
    "sessionClasses",
    "cleanupRequired",
    "providerIds",
    "closedParameters",
  ]);
  const extra = unknownField(input, allowed);
  if (extra) return failure("UNKNOWN_FIELD", `Capability descriptor field "${extra}" is not allowed.`);

  const capabilityId = nonEmptyString(input.capabilityId);
  const mode = executionMode(input.mode);
  if (!capabilityId) return failure("INVALID_IDENTIFIER", "capabilityId must be non-empty.");
  if (!mode) return failure("INVALID_MODE", "mode must be a supported execution mode.");

  const version = input.version === undefined ? "1.0.0" : nonEmptyString(input.version);
  const supportedAssetTypesRaw = input.supportedAssetTypes ?? [];
  if (!Array.isArray(supportedAssetTypesRaw)) return failure("INVALID_ARRAY", "supportedAssetTypes must be an array.");
  const supportedAssetTypes = supportedAssetTypesRaw.every(
    (value): value is AssetNodeType => typeof value === "string" && ASSET_NODE_TYPES.has(value as AssetNodeType),
  ) ? supportedAssetTypesRaw : null;
  const requiredObservationTypes = stringArray(input.requiredObservationTypes ?? []);
  const expectedEffects = stringArray(input.expectedEffects ?? []);
  const evidenceTypes = stringArray(input.evidenceTypes ?? []);
  const credentialClasses = stringArray(input.credentialClasses ?? []);
  const sessionClasses = stringArray(input.sessionClasses ?? []);
  const providerIds = stringArray(input.providerIds ?? []);
  const closedParameters = primitiveFacts(input.closedParameters ?? {});
  const maxRequestBudget = positiveInteger(input.maxRequestBudget, 1);
  const maxRuntimeMs = positiveInteger(input.maxRuntimeMs, 30_000);
  const stateMutationClass = input.stateMutationClass === undefined
    ? "none"
    : typeof input.stateMutationClass === "string" && STATE_MUTATION_CLASSES.has(input.stateMutationClass as StateMutationClass)
      ? input.stateMutationClass as StateMutationClass
      : null;
  const cleanupRequired = input.cleanupRequired === undefined ? false : input.cleanupRequired;

  if (!version) return failure("INVALID_IDENTIFIER", "version must be non-empty.");
  if (!supportedAssetTypes || !requiredObservationTypes || !expectedEffects || !evidenceTypes || !credentialClasses || !sessionClasses || !providerIds) {
    return failure("INVALID_ARRAY", "Capability descriptor list fields must contain only non-empty strings or supported asset types.");
  }
  if (!closedParameters) return failure("INVALID_PARAMETERS", "Capability closedParameters must contain primitive bounded values only.");
  if (!maxRequestBudget || !maxRuntimeMs) return failure("INVALID_NUMBER", "Capability budgets must be positive integers.");
  if (!stateMutationClass) return failure("INVALID_INPUT", "stateMutationClass is invalid.");
  if (typeof cleanupRequired !== "boolean") return failure("INVALID_INPUT", "cleanupRequired must be boolean.");

  return {
    ok: true,
    value: Object.freeze({
      capabilityId,
      version,
      supportedAssetTypes: Object.freeze([...supportedAssetTypes]),
      requiredObservationTypes: Object.freeze([...requiredObservationTypes]),
      mode,
      expectedEffects: Object.freeze([...expectedEffects]),
      evidenceTypes: Object.freeze([...evidenceTypes]),
      maxRequestBudget,
      maxRuntimeMs,
      stateMutationClass,
      credentialClasses: Object.freeze([...credentialClasses]),
      sessionClasses: Object.freeze([...sessionClasses]),
      cleanupRequired,
      providerIds: Object.freeze([...providerIds]),
      closedParameters,
    }),
  };
}

export function makeActionIntent(input: unknown): DomainConstructionResult<ActionIntent> {
  if (!isRecord(input)) return failure("INVALID_INPUT", "Action intent must be an object.");

  const allowed = new Set([
    "actionId",
    "hypothesisId",
    "capabilityId",
    "targetNodeIds",
    "requestedMode",
    "closedParameters",
    "expectedEvidenceTypes",
    "requestedCredentialClass",
    "requestedSessionClass",
  ]);
  const extra = unknownField(input, allowed);
  if (extra) return failure("UNKNOWN_FIELD", `Action intent field "${extra}" is not allowed.`);

  const actionId = nonEmptyString(input.actionId);
  const hypothesisId = nonEmptyString(input.hypothesisId);
  const capabilityId = nonEmptyString(input.capabilityId);
  const targetNodeIds = stringArray(input.targetNodeIds, { nonEmpty: true });
  const requestedMode = executionMode(input.requestedMode);
  const closedParameters = primitiveFacts(input.closedParameters ?? {});
  const expectedEvidenceTypes = stringArray(input.expectedEvidenceTypes, { nonEmpty: true });
  const requestedCredentialClass = input.requestedCredentialClass === undefined
    ? undefined
    : nonEmptyString(input.requestedCredentialClass) ?? null;
  const requestedSessionClass = input.requestedSessionClass === undefined
    ? undefined
    : nonEmptyString(input.requestedSessionClass) ?? null;

  if (!actionId || !hypothesisId || !capabilityId) {
    return failure("INVALID_IDENTIFIER", "Action, hypothesis, and capability IDs must be non-empty.");
  }
  if (!targetNodeIds) return failure("INVALID_ARRAY", "Action intent requires at least one target node.");
  if (!requestedMode) return failure("INVALID_MODE", "requestedMode must be a supported execution mode.");
  if (!closedParameters) return failure("INVALID_PARAMETERS", "closedParameters must contain primitive bounded values only.");
  if (!expectedEvidenceTypes) return failure("EVIDENCE_REQUIRED", "Action intent requires at least one expected evidence type.");
  if (requestedCredentialClass === null || requestedSessionClass === null) {
    return failure("INVALID_IDENTIFIER", "Requested credential/session classes must be non-empty when present.");
  }

  return {
    ok: true,
    value: Object.freeze({
      actionId,
      hypothesisId,
      capabilityId,
      targetNodeIds: Object.freeze([...targetNodeIds]),
      requestedMode,
      closedParameters,
      expectedEvidenceTypes: Object.freeze([...expectedEvidenceTypes]),
      ...(requestedCredentialClass ? { requestedCredentialClass } : {}),
      ...(requestedSessionClass ? { requestedSessionClass } : {}),
    }),
  };
}

export function makeActionAuthorization(
  input: unknown,
  now: Date = new Date(),
): DomainConstructionResult<ActionAuthorization> {
  if (!isRecord(input)) return failure("INVALID_INPUT", "Action authorization must be an object.");

  const allowed = new Set([
    "authorizationId",
    "actionId",
    "workspaceId",
    "targetNodeIds",
    "authorizationSnapshotRef",
    "capabilityId",
    "capabilityVersion",
    "executionMode",
    "maxRequests",
    "maxRuntimeMs",
    "expiresAt",
    "cancellationKey",
  ]);
  const extra = unknownField(input, allowed);
  if (extra) return failure("UNKNOWN_FIELD", `Action authorization field "${extra}" is not allowed.`);

  const authorizationId = nonEmptyString(input.authorizationId);
  const actionId = nonEmptyString(input.actionId);
  const workspaceId = nonEmptyString(input.workspaceId);
  const targetNodeIds = stringArray(input.targetNodeIds, { nonEmpty: true });
  const authorizationSnapshotRef = nonEmptyString(input.authorizationSnapshotRef);
  const capabilityId = nonEmptyString(input.capabilityId);
  const capabilityVersion = nonEmptyString(input.capabilityVersion);
  const mode = executionMode(input.executionMode);
  const maxRequests = positiveInteger(input.maxRequests);
  const maxRuntimeMs = positiveInteger(input.maxRuntimeMs);
  const expiresAt = isoDate(input.expiresAt);
  const cancellationKey = nonEmptyString(input.cancellationKey);

  if (!authorizationId || !actionId || !workspaceId || !authorizationSnapshotRef || !capabilityId || !capabilityVersion || !cancellationKey) {
    return failure("INVALID_IDENTIFIER", "Authorization identifiers must be non-empty.");
  }
  if (!targetNodeIds) return failure("INVALID_ARRAY", "Authorization requires at least one target node.");
  if (!mode) return failure("INVALID_MODE", "executionMode must be supported.");
  if (!maxRequests || !maxRuntimeMs) return failure("INVALID_NUMBER", "Authorization budgets must be positive integers.");
  if (!expiresAt) return failure("INVALID_INPUT", "expiresAt must be a valid timestamp.");
  if (Date.parse(expiresAt) <= now.getTime()) return failure("AUTHORIZATION_EXPIRED", "Authorization is already expired.");

  return {
    ok: true,
    value: Object.freeze({
      authorizationId,
      actionId,
      workspaceId,
      targetNodeIds: Object.freeze([...targetNodeIds]),
      authorizationSnapshotRef,
      capabilityId,
      capabilityVersion,
      executionMode: mode,
      maxRequests,
      maxRuntimeMs,
      expiresAt,
      cancellationKey,
    }),
  };
}

export function makeObservation(input: unknown): DomainConstructionResult<Observation> {
  if (!isRecord(input)) return failure("INVALID_INPUT", "Observation must be an object.");

  const allowed = new Set([
    "observationId",
    "runId",
    "providerId",
    "providerVersion",
    "capabilityId",
    "assetNodeIds",
    "evidenceRefs",
    "facts",
    "observedAt",
    "confidence",
    "authorizationSnapshotRef",
    "executionMode",
  ]);
  const extra = unknownField(input, allowed);
  if (extra) return failure("UNKNOWN_FIELD", `Observation field "${extra}" is not allowed.`);

  const observationId = nonEmptyString(input.observationId);
  const runId = nonEmptyString(input.runId);
  const providerId = nonEmptyString(input.providerId);
  const providerVersion = nonEmptyString(input.providerVersion);
  const capabilityId = nonEmptyString(input.capabilityId);
  const assetNodeIds = stringArray(input.assetNodeIds, { nonEmpty: true });
  const evidenceRefs = stringArray(input.evidenceRefs, { nonEmpty: true });
  const facts = primitiveFacts(input.facts ?? {});
  const observedAt = isoDate(input.observedAt);
  const confidence = finiteNumber(input.confidence, 0, 1);
  const authorizationSnapshotRef = nonEmptyString(input.authorizationSnapshotRef);
  const mode = executionMode(input.executionMode);

  if (!observationId || !runId || !providerId || !providerVersion || !capabilityId || !authorizationSnapshotRef) {
    return failure("INVALID_IDENTIFIER", "Observation identifiers must be non-empty.");
  }
  if (!assetNodeIds) return failure("INVALID_ARRAY", "Observation requires at least one asset node.");
  if (!evidenceRefs) return failure("EVIDENCE_REQUIRED", "Observation requires at least one evidence reference.");
  if (!facts) return failure("INVALID_PARAMETERS", "Observation facts must contain primitive normalized values only.");
  if (!observedAt) return failure("INVALID_INPUT", "observedAt must be a valid timestamp.");
  if (confidence === null) return failure("INVALID_NUMBER", "confidence must be between 0 and 1.");
  if (!mode) return failure("INVALID_MODE", "executionMode must be supported.");

  return {
    ok: true,
    value: Object.freeze({
      observationId,
      runId,
      providerId,
      providerVersion,
      capabilityId,
      assetNodeIds: Object.freeze([...assetNodeIds]),
      evidenceRefs: Object.freeze([...evidenceRefs]),
      facts,
      observedAt,
      confidence,
      authorizationSnapshotRef,
      executionMode: mode,
    }),
  };
}
