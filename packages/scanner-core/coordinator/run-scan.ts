import { compareFindings } from "../findings/severity";
import type { Finding, ScanError, ScanResult } from "../findings/types";
import type { RunScanInput, Scanner } from "./types";

function compareScanner(left: Scanner, right: Scanner): number {
  if (left.name < right.name) return -1;
  if (left.name > right.name) return 1;
  if (left.version < right.version) return -1;
  if (left.version > right.version) return 1;
  return 0;
}

function safeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/[\r\n\t]+/g, " ").trim().slice(0, 512) || "Scanner execution failed";
}

export async function runScan({ root, inventory, scanners }: RunScanInput): Promise<ScanResult> {
  const startedAt = new Date();
  const startedMs = Date.now();
  const orderedScanners = [...scanners].sort(compareScanner);
  const findingsByFingerprint = new Map<string, Finding>();
  const errors: ScanError[] = [];

  for (const scanner of orderedScanners) {
    try {
      const findings = await scanner.scan({ root, inventory });
      for (const finding of findings) {
        if (!findingsByFingerprint.has(finding.fingerprint)) {
          findingsByFingerprint.set(finding.fingerprint, finding);
        }
      }
    } catch (error) {
      errors.push({
        scanner: scanner.name,
        message: safeErrorMessage(error)
      });
    }
  }

  return {
    scan: {
      root,
      startedAt: startedAt.toISOString(),
      durationMs: Math.max(0, Date.now() - startedMs),
      scanners: orderedScanners.map((scanner) => `${scanner.name}@${scanner.version}`)
    },
    inventory: inventory.summary,
    findings: [...findingsByFingerprint.values()].sort(compareFindings),
    errors,
    policy: {
      mode: "report-only",
      passed: true
    }
  };
}
