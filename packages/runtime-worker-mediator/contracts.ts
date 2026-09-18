import type { RuntimeObservation } from "@/packages/runtime-observer";
import type { CorsPolicyObservation } from "@/packages/runtime-validator";

export type RuntimeMediatorExecutionClass =
  | "passive_runtime_observation_v1"
  | "active_cors_validation_v1"
  | "phase11_http_discovery_v1";

export interface RuntimeMediatorSessionIdentity {
  taskId: string;
  attemptId: string;
  executionClass: RuntimeMediatorExecutionClass;
  nonce: string;
}

export interface RuntimeMediatorRunRequest {
  operation: "run";
  session: RuntimeMediatorSessionIdentity;
}

export interface RuntimeMediatorPassiveResult {
  kind: "passive_runtime_observation";
  requestCount: number;
  redirectCount: number;
  observations: readonly RuntimeObservation[];
}

export interface RuntimeMediatorActiveCorsResult {
  kind: "active_cors_validation";
  requestCount: 1;
  observation: CorsPolicyObservation;
}

export interface RuntimeMediatorHttpDiscoveryRecord {
  routeKind: "root" | "security-txt" | "robots" | "sitemap";
  status: number;
  contentType?: string;
  redirected: boolean;
  redirectBlockedReason?: "CROSS_HOST" | "SCHEME" | "PORT" | "CREDENTIALS";
}

export interface RuntimeMediatorHttpDiscoveryResult {
  kind: "phase11_http_discovery";
  requestCount: number;
  records: readonly RuntimeMediatorHttpDiscoveryRecord[];
}

export type RuntimeMediatorResult =
  | RuntimeMediatorPassiveResult
  | RuntimeMediatorActiveCorsResult
  | RuntimeMediatorHttpDiscoveryResult;

export type RuntimeMediatorProtocolErrorCode =
  | "MEDIATOR_REQUEST_INVALID"
  | "MEDIATOR_SESSION_INVALID"
  | "MEDIATOR_SESSION_EXPIRED"
  | "MEDIATOR_SESSION_USED"
  | "MEDIATOR_RESULT_INVALID"
  | "MEDIATOR_RESULT_TOO_LARGE";

export class RuntimeMediatorProtocolError extends Error {
  readonly code: RuntimeMediatorProtocolErrorCode;

  constructor(code: RuntimeMediatorProtocolErrorCode) {
    super(code);
    this.name = "RuntimeMediatorProtocolError";
    this.code = code;
  }
}
