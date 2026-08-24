import { describe, expect, it } from "vitest";

import { serializeSarifResult } from "@/packages/scanner-output/sarif/serialize";
import type { Finding, ScanResult } from "@/packages/scanner-core/findings/types";

function finding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: `sf1:${"a".repeat(64)}`,
    fingerprint: `sf1:${"a".repeat(64)}`,
    scanner: "test",
    ruleId: "test/a-rule",
    ruleVersion: "1.0.0",
    title: "Test finding",
    description: "A deterministic test finding.",
    severity: "high",
    confidence: "high",
    category: "test",
    validation: "static_confirmed",
    provenance: "observed",
    location: {
      file: "src/a.ts",
      startLine: 5,
      startColumn: 2,
      endLine: 5,
      endColumn: 8
    },
    evidence: { summary: "Observed a safe normalized security condition." },
    cwe: ["CWE-78"],
    owasp: ["A03:2021"],
    references: ["https://example.invalid/reference"],
    remediation: {
      summary: "Use the safe API.",
      guidance: "Replace the unsafe construct with the supported safe pattern.",
      verification: "Run ScopeForge again and confirm the finding is absent."
    },
    metadata: {},
    baselineState: "new",
    ...overrides
  };
}

function scanResult(findings: Finding[]): ScanResult {
  return {
    scan: {
      root: "/tmp/repository",
      startedAt: "2026-08-24T00:00:00.000Z",
      durationMs: 42,
      scanners: ["test@1.0.0"]
    },
    inventory: {
      filesAnalyzed: 2,
      filesSkipped: 0,
      totalBytes: 20,
      languages: { TypeScript: 2 },
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
    },
    findings,
    errors: [],
    policy: { mode: "report-only", passed: true }
  };
}

describe("serializeSarifResult", () => {
  it("emits SARIF 2.1.0 with stable rules, fingerprints, locations, and safe metadata", () => {
    const high = finding({ baselineState: "existing" });
    const medium = finding({
      id: `sf1:${"b".repeat(64)}`,
      fingerprint: `sf1:${"b".repeat(64)}`,
      ruleId: "test/b-rule",
      title: "Second finding",
      severity: "medium",
      baselineState: "new",
      location: { file: "src/b.ts", startLine: 9, startColumn: 1, endLine: 9, endColumn: 4 },
      cwe: ["CWE-79"],
      owasp: []
    });

    const parsed = JSON.parse(
      serializeSarifResult(scanResult([medium, high]), { toolVersion: "0.1.0" })
    );

    expect(parsed.$schema).toContain("sarif");
    expect(parsed.version).toBe("2.1.0");
    expect(parsed.runs).toHaveLength(1);
    expect(parsed.runs[0].tool.driver.name).toBe("ScopeForge");
    expect(parsed.runs[0].tool.driver.version).toBe("0.1.0");
    expect(parsed.runs[0].tool.driver.rules.map((rule: { id: string }) => rule.id)).toEqual([
      "test/a-rule",
      "test/b-rule"
    ]);

    const results = parsed.runs[0].results;
    expect(results.map((result: { ruleId: string }) => result.ruleId)).toEqual([
      "test/a-rule",
      "test/b-rule"
    ]);
    expect(results[0].ruleIndex).toBe(0);
    expect(results[1].ruleIndex).toBe(1);
    expect(results[0].level).toBe("error");
    expect(results[1].level).toBe("warning");
    expect(results[0].baselineState).toBe("unchanged");
    expect(results[1].baselineState).toBe("new");
    expect(results[0].partialFingerprints["scopeforge/v1"]).toBe(high.fingerprint);
    expect(results[0].locations[0].physicalLocation).toEqual({
      artifactLocation: { uri: "src/a.ts", uriBaseId: "%SRCROOT%" },
      region: { startLine: 5, startColumn: 2, endLine: 5, endColumn: 8 }
    });
    expect(parsed.runs[0].originalUriBaseIds).toEqual({ "%SRCROOT%": { uri: "./" } });

    const firstRule = parsed.runs[0].tool.driver.rules[0];
    expect(firstRule.shortDescription.text).toBe("Test finding");
    expect(firstRule.fullDescription.text).toBe("A deterministic test finding.");
    expect(firstRule.help.text).toContain("Use the safe API.");
    expect(firstRule.properties.tags).toEqual(["security", "CWE-78", "A03:2021"]);
  });

  it("maps low and info to note, omits none baseline state, and deduplicates rule metadata", () => {
    const low = finding({ severity: "low", baselineState: "none" });
    const info = finding({
      id: `sf1:${"c".repeat(64)}`,
      fingerprint: `sf1:${"c".repeat(64)}`,
      severity: "info",
      ruleId: "test/a-rule",
      location: { file: "src/c.ts", startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 }
    });

    const parsed = JSON.parse(serializeSarifResult(scanResult([info, low])));
    expect(parsed.runs[0].tool.driver.rules).toHaveLength(1);
    expect(parsed.runs[0].results).toHaveLength(2);
    expect(parsed.runs[0].results.every((result: { level: string }) => result.level === "note")).toBe(true);
    expect(parsed.runs[0].results[0]).not.toHaveProperty("baselineState");
  });

  it("serializes equivalent finding sets byte-for-byte deterministically", () => {
    const firstFinding = finding();
    const secondFinding = finding({
      id: `sf1:${"d".repeat(64)}`,
      fingerprint: `sf1:${"d".repeat(64)}`,
      ruleId: "test/z-rule",
      severity: "low",
      location: { file: "z.ts", startLine: 2, startColumn: 1, endLine: 2, endColumn: 2 }
    });

    const first = serializeSarifResult(scanResult([secondFinding, firstFinding]));
    const second = serializeSarifResult(scanResult([firstFinding, secondFinding]));
    expect(first).toBe(second);
    expect(first.endsWith("\n")).toBe(true);
  });

  it("keeps unsafe repository locations out of SARIF without dropping findings", () => {
    const absolute = finding({ location: { file: "/etc/passwd", startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 } });
    const traversal = finding({
      id: `sf1:${"e".repeat(64)}`,
      fingerprint: `sf1:${"e".repeat(64)}`,
      ruleId: "test/traversal",
      location: { file: "../outside.ts", startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 }
    });

    const parsed = JSON.parse(serializeSarifResult(scanResult([absolute, traversal])));
    expect(parsed.runs[0].results).toHaveLength(2);
    expect(parsed.runs[0].results.every((result: { locations?: unknown }) => result.locations === undefined)).toBe(true);
  });
});
