import type { ValidationAccuracyErrorCode } from "./contracts";

export class ValidationAccuracyError extends Error {
  constructor(
    readonly code: ValidationAccuracyErrorCode,
    message: string,
    readonly field?: string,
  ) {
    super(message);
    this.name = "ValidationAccuracyError";
  }
}
