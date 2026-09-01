export type SecurityPackErrorCode =
  | "PACK_PATH_INVALID"
  | "PACK_MANIFEST_TOO_LARGE"
  | "PACK_MANIFEST_INVALID"
  | "PACK_IDENTITY_INVALID"
  | "PACK_DUPLICATE_RULE"
  | "PACK_BUDGET_EXCEEDED"
  | "PACK_FIXTURE_INVALID"
  | "PACK_FIXTURE_MISMATCH"
  | "PACK_RULE_COLLISION"
  | "PACK_SCAN_LIMIT_EXCEEDED";

export class SecurityPackError extends Error {
  constructor(
    readonly code: SecurityPackErrorCode,
    message: string,
    readonly field?: string,
  ) {
    super(message);
    this.name = "SecurityPackError";
  }
}
