import type { Scanner, ScannerContext } from "../scanner-core/coordinator/types";
import { compareText } from "../scanner-core/determinism/compare-text";
import { readInventoryEntry } from "../scanner-core/filesystem/read-inventory-entry";
import type { Finding } from "../scanner-core/findings/types";
import { scanSecretText } from "./scan-file";
import type { SecretRuleSelection } from "./rules/types";

export interface CreateSecretScannerOptions {
  allowFingerprints?: string[];
  rules?: SecretRuleSelection;
}

export interface SecretScanner extends Scanner {
  scan(context: ScannerContext): Promise<Finding[]>;
}

function compareSecretFindings(left: Finding, right: Finding): number {
  return (
    compareText(left.location.file, right.location.file) ||
    left.location.startLine - right.location.startLine ||
    left.location.startColumn - right.location.startColumn ||
    compareText(left.ruleId, right.ruleId) ||
    compareText(left.fingerprint, right.fingerprint)
  );
}

export function createSecretScanner(options: CreateSecretScannerOptions = {}): SecretScanner {
  const allowed = new Set(options.allowFingerprints ?? []);

  return {
    name: "secrets",
    version: "1.0.0",
    async scan({ inventory }) {
      const byFingerprint = new Map<string, Finding>();

      for (const entry of inventory.entries) {
        const content = await readInventoryEntry(inventory, entry.path);
        if (content.includes("\0")) continue;

        for (const finding of scanSecretText({ file: entry.path, content, options: options.rules })) {
          if (allowed.has(finding.fingerprint)) continue;
          if (!byFingerprint.has(finding.fingerprint)) byFingerprint.set(finding.fingerprint, finding);
        }
      }

      return [...byFingerprint.values()].sort(compareSecretFindings);
    }
  };
}
