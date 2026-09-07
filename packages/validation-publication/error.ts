import type { PublicationEvidenceErrorCode } from "./contracts";

export class PublicationEvidenceError extends Error {
  readonly code: PublicationEvidenceErrorCode;
  readonly field?: string;

  constructor(code: PublicationEvidenceErrorCode, message: string, field?: string) {
    super(message);
    this.name = "PublicationEvidenceError";
    this.code = code;
    this.field = field;
  }
}
