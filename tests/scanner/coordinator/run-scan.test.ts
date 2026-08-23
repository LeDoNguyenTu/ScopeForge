import { describe, expect, it } from "vitest";

import { runScan } from "@/packages/scanner-core/coordinator/run-scan";
import type { Scanner } from "@/packages/scanner-core/coordinator/types";
import type { Finding } from "@/packages/scanner-core/findings/types";
import type { RepositoryInventory } from "@/packages/scanner-core/inventory/types";

function makeFinding(
  fingerprint: string,
  severity: Finding["severity"],
  file: string,
  ruleId: string
): Finding {
  return {
    id: fingerprint,
    fingerprint,
    scanner: "test",
    ruleId,
    ruleVersion: "1.0.0",
    title: ruleId,
    description: `Finding for ${ruleId}`,
    severity,
    confidence: "high",
    category: "test",
    validation: "static_confirmed",
    provenance: "observed",
    location: {
      file,
      startLine: 10,
      startColumn: 1,
      endLine: 10,
      endColumn: 5
    },
    evidence: {
      summary: "safe evidence",
      redactedSnippet: "[REDACTED]"
    },
    cwe: ["CWE-78"],
    owasp: ["A03:2021"],
    references: [],
    remediation: {
      summary: "Use a safe API",
      guidance: "Avoid unsafe execution.",
      verification: "Run the scanner again."
    },
    metadata: {},
    baselineState: "new"
  };
}

const inventory: RepositoryInventory = {
  root: "/repo",
  entries: [],
  summary: {
    filesAnalyzed: 0,
    filesSkipped: 0,
    totalBytes: 0,
    languages: {},
    manifests: [],
    infrastructure: [],
    skippedByReason: {
      default_exclude: 0,
      gitignore: 0,
      scopeforgeignore: 0,
      symlink: 0,
      file_too_large: 0,
      file_limit: 0,
      total_bytes_limit: 0,
      unreadable: 0
    }
  }
};

describe("runScan", () => {
  it("deduplicates findings and orders them deterministically", async () => {
    const duplicate = makeFinding("sf1:duplicate", "low", "src/z.ts", "duplicate-rule");
    const high = makeFinding("sf1:high", "high", "src/a.ts", "high-rule");

    const scanners: Scanner[] = [
      {
        name: "zeta",
        version: "1.0.0",
        scan: async () => [duplicate]
      },
      {
        name: "alpha",
        version: "1.0.0",
        scan: async () => [high, { ...duplicate, title: "same identity from alpha" }]
      }
    ];

    const result = await runScan({ root: "/repo", inventory, scanners });

    expect(result.scan.scanners).toEqual(["alpha@1.0.0", "zeta@1.0.0"]);
    expect(result.findings.map((finding) => finding.fingerprint)).toEqual([
      "sf1:high",
      "sf1:duplicate"
    ]);
    expect(result.findings[1]?.title).toBe("same identity from alpha");
    expect(result.errors).toEqual([]);
    expect(result.policy).toEqual({ mode: "report-only", passed: true });
  });

  it("captures scanner failures instead of treating them as a clean result", async () => {
    const scanners: Scanner[] = [
      {
        name: "broken",
        version: "1.2.3",
        scan: async () => {
          throw new Error("parser failed safely");
        }
      }
    ];

    const result = await runScan({ root: "/repo", inventory, scanners });

    expect(result.findings).toEqual([]);
    expect(result.errors).toEqual([
      {
        scanner: "broken",
        message: "parser failed safely"
      }
    ]);
  });

  it("preserves valid findings while collecting structured per-file scanner diagnostics", async () => {
    const finding = makeFinding("sf1:partial", "medium", "src/good.ts", "partial-rule");
    const scanners: Scanner[] = [
      {
        name: "jsts",
        version: "1.0.0",
        scan: async () => ({
          findings: [finding],
          errors: [
            {
              code: "syntax_error",
              file: "src/broken.ts",
              message: "Source file contains syntax errors.\nignored newline"
            }
          ]
        })
      }
    ];

    const result = await runScan({ root: "/repo", inventory, scanners });

    expect(result.findings).toEqual([finding]);
    expect(result.errors).toEqual([
      {
        scanner: "jsts",
        code: "syntax_error",
        file: "src/broken.ts",
        message: "Source file contains syntax errors. ignored newline"
      }
    ]);
  });
});
