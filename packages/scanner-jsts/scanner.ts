import type { Scanner, ScannerDiagnostic, ScannerRunResult } from "../scanner-core/coordinator/types";
import type { ScannerRuleSelection } from "../scanner-core/config/types";
import { InventoryReadError, readInventoryEntry } from "../scanner-core/filesystem/read-inventory-entry";
import { compareFindings } from "../scanner-core/findings/severity";
import type { Finding } from "../scanner-core/findings/types";
import { parseSource } from "./parser/parse-source";
import { scriptKindForPath } from "./parser/script-kind";
import { scanSourceFile } from "./scan-source";

export interface CreateJstsScannerOptions {
  rules?: ScannerRuleSelection;
  maxAstNodes?: number;
}

const DEFAULT_MAX_AST_NODES = 200_000;

function diagnosticForReadError(file: string, error: InventoryReadError): ScannerDiagnostic {
  return {
    code: `filesystem_${error.code}`,
    file,
    message: "Source file could not be read safely."
  };
}

export function createJstsScanner(options: CreateJstsScannerOptions = {}): Scanner {
  const maxAstNodes = options.maxAstNodes ?? DEFAULT_MAX_AST_NODES;
  if (!Number.isSafeInteger(maxAstNodes) || maxAstNodes <= 0) {
    throw new Error("JavaScript/TypeScript AST node budget must be a positive safe integer.");
  }

  return {
    name: "jsts",
    version: "1.0.0",
    async scan({ inventory }): Promise<ScannerRunResult> {
      const findingsByFingerprint = new Map<string, Finding>();
      const errors: ScannerDiagnostic[] = [];

      for (const entry of inventory.entries) {
        if (entry.kind !== "source" || scriptKindForPath(entry.path) === null) continue;

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

        if (content.includes("\0")) {
          errors.push({
            code: "unsupported_binary_source",
            file: entry.path,
            message: "Source file contains NUL bytes and was not parsed as JavaScript/TypeScript."
          });
          continue;
        }

        const parsed = parseSource({ file: entry.path, content });
        if ("error" in parsed) {
          errors.push({ ...parsed.error, file: entry.path });
          continue;
        }

        const scanned = scanSourceFile({
          file: entry.path,
          sourceFile: parsed.sourceFile,
          rules: options.rules,
          maxNodes: maxAstNodes
        });
        if (scanned.error) {
          errors.push(scanned.error);
          continue;
        }

        for (const finding of scanned.findings) {
          if (!findingsByFingerprint.has(finding.fingerprint)) {
            findingsByFingerprint.set(finding.fingerprint, finding);
          }
        }
      }

      return {
        findings: [...findingsByFingerprint.values()].sort(compareFindings),
        errors
      };
    }
  };
}
