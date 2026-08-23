import { compareFindings } from "../../scanner-core/findings/severity";
import type { ScanResult } from "../../scanner-core/findings/types";

export interface SerializeScanResultOptions {
  toolVersion?: string;
}

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

function canonicalize(value: unknown): JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === "object") {
    const object = value as Record<string, unknown>;
    const canonical: Record<string, JsonValue> = {};
    for (const key of Object.keys(object).sort()) {
      const child = object[key];
      if (child !== undefined) canonical[key] = canonicalize(child);
    }
    return canonical;
  }
  return String(value);
}

export function serializeScanResult(
  result: ScanResult,
  options: SerializeScanResultOptions = {}
): string {
  const envelope = {
    schemaVersion: 1,
    tool: {
      name: "ScopeForge",
      version: options.toolVersion ?? "0.1.0"
    },
    scan: {
      ...result.scan,
      scanners: [...result.scan.scanners].sort()
    },
    inventory: {
      ...result.inventory,
      languages: canonicalize(result.inventory.languages),
      manifests: [...result.inventory.manifests].sort(),
      infrastructure: [...result.inventory.infrastructure].sort(),
      skippedByReason: canonicalize(result.inventory.skippedByReason)
    },
    findings: [...result.findings].sort(compareFindings).map(canonicalize),
    errors: [...result.errors].sort((left, right) => {
      const fields: Array<[string, string]> = [
        [left.scanner, right.scanner],
        [left.file ?? "", right.file ?? ""],
        [left.code ?? "", right.code ?? ""],
        [left.message, right.message]
      ];
      for (const [leftValue, rightValue] of fields) {
        if (leftValue < rightValue) return -1;
        if (leftValue > rightValue) return 1;
      }
      return 0;
    }),
    policy: result.policy
  };

  return `${JSON.stringify(envelope, null, 2)}\n`;
}
