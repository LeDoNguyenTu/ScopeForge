import type {
  Scanner,
  ScannerDiagnostic,
  ScannerRunResult,
} from "../scanner-core/coordinator/types";
import { readInventoryEntryBytes } from "../scanner-core/filesystem/read-inventory-entry";
import { compareFindings } from "../scanner-core/findings/severity";
import type { Finding } from "../scanner-core/findings/types";
import { SECURITY_PACK_LIMITS } from "./contracts";
import { createSecurityPackFinding } from "./finding";
import { matchStaticLiteralContent } from "./literal-matcher";
import type { SecurityPackRegistry } from "./registry";

function safeReadDiagnostic(file: string): ScannerDiagnostic {
  return {
    code: "PACK_PATH_INVALID",
    file,
    message: "Pack candidate file could not be read safely.",
  };
}

function findingLimitDiagnostic(): ScannerDiagnostic {
  return {
    code: "PACK_SCAN_LIMIT_EXCEEDED",
    message: "Security Pack finding limit was exceeded.",
  };
}

export function createSecurityPackScanner(registry: SecurityPackRegistry): Scanner {
  return {
    name: "security-pack",
    version: "1.0.0",
    async scan({ inventory }): Promise<ScannerRunResult> {
      const findings = new Map<string, Finding>();
      const perPackFindings = new Map<string, number>();
      const errors: ScannerDiagnostic[] = [];

      for (const entry of inventory.entries) {
        const candidateRules = registry.rules.filter((registered) =>
          registered.matchesPath(entry.path),
        );
        if (candidateRules.length === 0) continue;

        let bytes: Buffer;
        try {
          bytes = await readInventoryEntryBytes(inventory, entry.path);
        } catch {
          errors.push(safeReadDiagnostic(entry.path));
          continue;
        }

        for (const registered of candidateRules) {
          const match = matchStaticLiteralContent(registered.rule, bytes);
          if (match === null) continue;

          const packId = registered.pack.manifest.packId;
          const nextCount = (perPackFindings.get(packId) ?? 0) + 1;
          if (nextCount > SECURITY_PACK_LIMITS.findingsPerPack) {
            errors.push(findingLimitDiagnostic());
            return {
              findings: [...findings.values()].sort(compareFindings),
              errors,
            };
          }
          perPackFindings.set(packId, nextCount);

          const finding = createSecurityPackFinding({
            pack: registered.pack.manifest,
            rule: registered.rule,
            file: entry.path,
            match,
          });
          findings.set(finding.fingerprint, finding);
        }
      }

      return {
        findings: [...findings.values()].sort(compareFindings),
        errors,
      };
    },
  };
}
