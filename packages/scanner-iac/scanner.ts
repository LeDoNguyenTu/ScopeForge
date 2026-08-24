import type { ScannerRuleSelection } from "../scanner-core/config/types";
import type { Scanner, ScannerDiagnostic, ScannerRunResult } from "../scanner-core/coordinator/types";
import { InventoryReadError, readInventoryEntry } from "../scanner-core/filesystem/read-inventory-entry";
import { compareFindings } from "../scanner-core/findings/severity";
import type { Finding } from "../scanner-core/findings/types";
import { scanDockerfile } from "./docker/scan";

export interface CreateIacScannerOptions {
  rules?: ScannerRuleSelection;
  maxDockerInstructions?: number;
  maxDockerInstructionBytes?: number;
}

function isDockerfile(path: string): boolean {
  const name = path.split("/").at(-1);
  return name === "Dockerfile" || Boolean(name?.startsWith("Dockerfile."));
}

function diagnosticForReadError(file: string, error: InventoryReadError): ScannerDiagnostic {
  return {
    code: `filesystem_${error.code}`,
    file,
    message: "Dockerfile could not be read safely."
  };
}

export function createIacScanner(options: CreateIacScannerOptions = {}): Scanner {
  return {
    name: "iac",
    version: "1.0.0",
    async scan({ inventory }): Promise<ScannerRunResult> {
      const findingsByFingerprint = new Map<string, Finding>();
      const errors: ScannerDiagnostic[] = [];

      for (const entry of inventory.entries) {
        if (entry.kind !== "infrastructure" || !isDockerfile(entry.path)) continue;

        let content: string;
        try {
          content = await readInventoryEntry(inventory, entry.path);
        } catch (error) {
          if (error instanceof InventoryReadError) {
            errors.push(diagnosticForReadError(entry.path, error));
            continue;
          }
          throw error;
        }

        const scanned = scanDockerfile({
          file: entry.path,
          content,
          ...(options.rules ? { rules: options.rules } : {}),
          parser: {
            ...(options.maxDockerInstructions !== undefined
              ? { maxInstructions: options.maxDockerInstructions }
              : {}),
            ...(options.maxDockerInstructionBytes !== undefined
              ? { maxInstructionBytes: options.maxDockerInstructionBytes }
              : {})
          }
        });

        for (const finding of scanned.findings) {
          if (!findingsByFingerprint.has(finding.fingerprint)) {
            findingsByFingerprint.set(finding.fingerprint, finding);
          }
        }
        errors.push(...scanned.errors);
      }

      return {
        findings: [...findingsByFingerprint.values()].sort(compareFindings),
        errors
      };
    }
  };
}
