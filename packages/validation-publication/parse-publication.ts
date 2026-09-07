import { parseDocument } from "yaml";

import {
  PUBLICATION_EVIDENCE_LIMITS,
  type ResolvedPublicationEvidenceV1,
} from "./contracts";
import { PublicationEvidenceError } from "./error";
import { parsePublicationEvidence as parseLegacyPublicationEvidence } from "./parse";

function fail(message: string, field?: string): never {
  throw new PublicationEvidenceError("PUBLICATION_EVIDENCE_INVALID", message, field);
}

function exactKeys(value: unknown, expected: readonly string[], field: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return fail("Publication evidence field must be an object.", field);
  }
  const object = value as Record<string, unknown>;
  const actual = Object.keys(object).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    return fail("Publication evidence object contains missing or unknown fields.", field);
  }
  return object;
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return Object.freeze(value);
}

export function parseTechnicalPublicationEvidence(raw: string): ResolvedPublicationEvidenceV1 {
  if (Buffer.byteLength(raw, "utf8") > PUBLICATION_EVIDENCE_LIMITS.evidenceBytes) {
    return fail("Publication evidence exceeds its fixed byte budget.");
  }
  const duplicateCheck = parseDocument(raw, { schema: "json", uniqueKeys: true });
  if (duplicateCheck.errors.length > 0) return fail("Publication evidence is not strict unique-key JSON.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return fail("Publication evidence is not valid JSON.");
  }
  const root = exactKeys(parsed, [
    "schemaVersion",
    "publicationId",
    "source",
    "accuracy",
    "performance",
    "limitations",
    "unsupportedScenarios",
    "claimBoundaries",
    "reproduction",
  ], "root");
  const source = exactKeys(root.source, [
    "repository",
    "phase8aCommit",
    "phase8aTree",
    "phase8bCommit",
    "phase8bTree",
    "scopeforgeVersion",
  ], "source");
  if (typeof source.phase8aTree !== "string" || !/^[a-f0-9]{40}$/u.test(source.phase8aTree)) {
    return fail("Publication evidence Phase 8A tree must be a lowercase 40-hex value.", "source.phase8aTree");
  }

  const legacySource = { ...source };
  delete legacySource.phase8aTree;
  const legacy = parseLegacyPublicationEvidence(JSON.stringify({ ...root, source: legacySource }));
  return deepFreeze({
    ...legacy,
    source: {
      ...legacy.source,
      phase8aTree: source.phase8aTree,
    },
  });
}

export const parsePublicationEvidence = parseTechnicalPublicationEvidence;
