import { createHash } from "node:crypto";

export interface FindingFingerprintInput {
  scanner: string;
  ruleId: string;
  file: string;
  structuralContext: string;
  source?: string;
  sink?: string;
}

function normalizePath(value: string): string {
  return value
    .replace(/\\/g, "/")
    .replace(/\/{2,}/g, "/")
    .replace(/^\.\//, "")
    .trim();
}

function normalizeIdentifier(value: string | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

export function createFindingFingerprint(input: FindingFingerprintInput): string {
  const canonicalIdentity = {
    scanner: input.scanner.trim().toLowerCase(),
    ruleId: input.ruleId.trim().toLowerCase(),
    file: normalizePath(input.file),
    structuralContext: normalizeIdentifier(input.structuralContext),
    source: normalizeIdentifier(input.source),
    sink: normalizeIdentifier(input.sink)
  };

  const digest = createHash("sha256")
    .update(JSON.stringify(canonicalIdentity), "utf8")
    .digest("hex");

  return `sf1:${digest}`;
}
