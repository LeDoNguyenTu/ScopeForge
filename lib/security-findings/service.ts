import type {
  FindingLifecycleState,
  WorkspaceRole,
} from "@/lib/database.types";
import { canTransitionFindingLifecycle } from "@/packages/security-domain";
import type { SecurityFindingRepository } from "./repository";

export type Phase5ALifecycleAction =
  | "acknowledge"
  | "start_work"
  | "resolve"
  | "reopen";

export interface ChangeFindingLifecycleInput {
  actorId: string | null;
  workspaceId: string;
  role: WorkspaceRole | null;
  findingId: string;
  action: Phase5ALifecycleAction;
  note?: string;
}

export interface FindingLifecycleServiceDependencies {
  repository: SecurityFindingRepository;
}

export type FindingLifecycleWorkflowErrorCode =
  | "FINDING_LIFECYCLE_FORBIDDEN"
  | "FINDING_NOT_AVAILABLE"
  | "FINDING_LIFECYCLE_ACTION_INVALID"
  | "FINDING_LIFECYCLE_NOTE_INVALID";

const REASONS: Readonly<Record<FindingLifecycleWorkflowErrorCode, string>> = Object.freeze({
  FINDING_LIFECYCLE_FORBIDDEN: "Your workspace role cannot change finding lifecycle state.",
  FINDING_NOT_AVAILABLE: "The security finding is not available in this workspace.",
  FINDING_LIFECYCLE_ACTION_INVALID: "That lifecycle action is not available for the current finding state.",
  FINDING_LIFECYCLE_NOTE_INVALID: "Resolve and reopen actions require a note of at most 1000 characters.",
});

const WRITE_ROLES = new Set<WorkspaceRole>(["owner", "admin", "member"]);

const ACTION_TARGET: Readonly<Record<Phase5ALifecycleAction, FindingLifecycleState>> = Object.freeze({
  acknowledge: "acknowledged",
  start_work: "in_progress",
  resolve: "resolved",
  reopen: "in_progress",
});

const ACTION_FROM = {
  acknowledge: ["open"],
  start_work: ["open", "acknowledged"],
  resolve: ["in_progress"],
  reopen: ["resolved"],
} as const satisfies Readonly<Record<Phase5ALifecycleAction, readonly FindingLifecycleState[]>>;

export class FindingLifecycleWorkflowError extends Error {
  readonly code: FindingLifecycleWorkflowErrorCode;
  readonly reason: string;

  constructor(code: FindingLifecycleWorkflowErrorCode) {
    super(REASONS[code]);
    this.name = "FindingLifecycleWorkflowError";
    this.code = code;
    this.reason = REASONS[code];
  }
}

function normalizeNote(
  action: Phase5ALifecycleAction,
  note: string | undefined,
): string | null {
  const normalized = note?.trim() ?? "";
  if (normalized.length > 1000) {
    throw new FindingLifecycleWorkflowError("FINDING_LIFECYCLE_NOTE_INVALID");
  }
  if ((action === "resolve" || action === "reopen") && normalized.length === 0) {
    throw new FindingLifecycleWorkflowError("FINDING_LIFECYCLE_NOTE_INVALID");
  }
  return normalized.length > 0 ? normalized : null;
}

export async function changeFindingLifecycle(
  input: ChangeFindingLifecycleInput,
  dependencies: FindingLifecycleServiceDependencies,
) {
  if (!input.actorId || !input.role || !WRITE_ROLES.has(input.role)) {
    throw new FindingLifecycleWorkflowError("FINDING_LIFECYCLE_FORBIDDEN");
  }

  const current = await dependencies.repository.loadFinding(
    input.workspaceId,
    input.findingId,
  );
  if (!current) {
    throw new FindingLifecycleWorkflowError("FINDING_NOT_AVAILABLE");
  }

  const nextLifecycle = ACTION_TARGET[input.action];
  if (!nextLifecycle
      || !(ACTION_FROM[input.action] as readonly FindingLifecycleState[]).includes(current.lifecycle_state)
      || !canTransitionFindingLifecycle(current.lifecycle_state, nextLifecycle)) {
    throw new FindingLifecycleWorkflowError("FINDING_LIFECYCLE_ACTION_INVALID");
  }

  const reason = normalizeNote(input.action, input.note);
  return dependencies.repository.changeLifecycle({
    workspaceId: input.workspaceId,
    findingId: input.findingId,
    expectedLifecycle: current.lifecycle_state,
    nextLifecycle,
    actorId: input.actorId,
    reason,
  });
}
