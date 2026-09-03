import type { ActiveValidationBudget, AuthorizedValidationTarget } from "@/packages/runtime-validator";
import type { AuthorizedRuntimeTarget, RuntimeObservationBudget } from "@/packages/runtime-observer";

export type RuntimeWorkerExecutionClass =
  | "passive_runtime_observation_v1"
  | "active_cors_validation_v1";

export type RuntimeWorkerDomainJobKind = "passive_runtime" | "active_validation";

export interface RuntimeWorkerPreparationIdentity {
  workerId: string;
  taskId: string;
  attemptId: string;
  leaseToken: string;
}

export interface RuntimeWorkerPreparationContext {
  taskId: string;
  attemptId: string;
  executionClass: RuntimeWorkerExecutionClass;
  domainJobId: string;
  workspaceId: string;
  assetId: string;
  requestedBy: string;
  domainJobKind: RuntimeWorkerDomainJobKind;
  leaseExpiresAt: string;
  absoluteDeadlineAt: string;
}

export interface PreparedPassiveRuntimeExecution {
  taskId: string;
  attemptId: string;
  executionClass: "passive_runtime_observation_v1";
  domainJobId: string;
  expiresAt: string;
  target: AuthorizedRuntimeTarget;
  budget: Readonly<RuntimeObservationBudget>;
}

export interface PreparedActiveCorsExecution {
  taskId: string;
  attemptId: string;
  executionClass: "active_cors_validation_v1";
  domainJobId: string;
  expiresAt: string;
  target: AuthorizedValidationTarget;
  budget: Readonly<ActiveValidationBudget>;
}

export type PreparedRuntimeWorkerExecution =
  | PreparedPassiveRuntimeExecution
  | PreparedActiveCorsExecution;
