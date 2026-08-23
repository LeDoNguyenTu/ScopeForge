import { createHash } from "node:crypto";

export interface CreateSecretFingerprintInput {
  ruleId: string;
  file: string;
  structuralContext: string;
  secret: string;
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function normalizeFile(file: string): string {
  return file.replace(/\\/g, "/").replace(/^\.\//, "");
}

function normalizeContext(context: string, secret: string): string {
  return context
    .split(secret).join("<secret>")
    .trim()
    .replace(/\s+/g, " ");
}

export function createSecretFingerprint(input: CreateSecretFingerprintInput): string {
  const secretDigest = sha256(input.secret);
  const identity = [
    "scopeforge-secret-v1",
    input.ruleId.trim().toLowerCase(),
    normalizeFile(input.file),
    normalizeContext(input.structuralContext, input.secret),
    secretDigest
  ].join("\n");

  return `sfs1:${sha256(identity)}`;
}
