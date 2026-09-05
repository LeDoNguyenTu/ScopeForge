import type { ValidationAccuracyResult } from "./contracts";

export function serializeValidationAccuracyJson(result: ValidationAccuracyResult): string {
  return `${JSON.stringify(result, null, 2)}\n`;
}
