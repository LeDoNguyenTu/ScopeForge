import { describe, expect, it } from "vitest";

import { serializeSarifResult } from "@/packages/scanner-output/sarif/serialize";
import type { Finding, ScanResult } from "@/packages/scanner-core/findings/types";

const SECRET_SENTINEL = "ghp_SCOPEFORGE_SARIF_SECRET_SENTINEL_4b91";
const SNIPPET_SENTINEL = "SARIF_SOURCE_SNIPPET_SENTINEL_8d12";
const METADATA_SENTINEL = "SARIF_METADATA_SENTINEL_713a";
const FLOW_SENTINEL = "SARIF_DATAFLOW_SENTINEL_0f66";
const ROOT_SENTINEL = "/private/build/agent/SARIF_ROOT_SENTINEL";

function secretFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: `sfs1:${"1".repeat(64)}`,
    fingerprint: `sfs1:${"1".repeat(64)}`,
    scanner: "secrets",
    ruleId: "secrets/github-token",
    ruleVersion: "1.0.0",
    title: "GitHub token exposed",
    description: "A GitHub credential pattern was detected.",
    severity: "high",
    confidence: "high",
    category: "secret",
    validation: "static_confirmed",
    provenance: "observed",
    location: { file: "src/secret.ts", startLine: 3, startColumn: 1, endLine: 3, endColumn: 2 },
    evidence: {
      summary: "Observed a redacted GitHub credential pattern.",
      redactedSnippet: `${SNIPPET_SENTINEL}:${SECRET_SENTINEL}`,
      dataFlow: [{ file: "src/secret.ts", line: 3, label: FLOW_SENTINEL }]
    },
    cwe: ["CWE-798"],
    owasp: [],
    references: [],
    remediation: {
      summary: "Revoke and replace the credential.",
      guidance: "Remove the credential from source and use a secret store.",
      verification: "Rescan after rotating the credential."
    },
    metadata: {
      raw: SECRET_SENTINEL,
      arbitrary: METADATA_SENTINEL
    },
    baselineState: "new",
    ...overrides
  };
}

function result(findings: Finding[]): ScanResult {
  return {
    scan: {
      root: ROOT_SENTINEL,
      startedAt: "2026-08-24T00:00:00.000Z",
      durationMs: 5,
      scanners: ["secrets@1.0.0"]
    },
    inventory: {
      filesAnalyzed: 1,
      filesSkipped: 0,
      totalBytes: 1,
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
    },
    findings,
    errors: [],
    policy: { mode: "report-only", passed: true }
  };
}

describe("SARIF security regressions", () => {
  it("uses a fixed allowlist and never copies snippets, data flow, arbitrary metadata, secrets, or local root paths", () => {
    const output = serializeSarifResult(result([secretFinding()]));

    expect(output).not.toContain(SECRET_SENTINEL);
    expect(output).not.toContain(SNIPPET_SENTINEL);
    expect(output).not.toContain(METADATA_SENTINEL);
    expect(output).not.toContain(FLOW_SENTINEL);
    expect(output).not.toContain(ROOT_SENTINEL);
    expect(output).toContain("Observed a redacted GitHub credential pattern.");
    expect(output).toContain("Revoke and replace the credential.");
  });

  it("retains fingerprints but omits unsafe absolute, traversal, backslash, and drive-letter locations", () => {
    const paths = ["/etc/passwd", "../outside.ts", "src\\escape.ts", "C:\\Windows\\system.ini"];
    const findings = paths.map((file, index) =>
      secretFinding({
        id: `sfs1:${String(index + 2).repeat(64)}`,
        fingerprint: `sfs1:${String(index + 2).repeat(64)}`,
        ruleId: `secrets/test-${index}`,
        location: { file, startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 }
      })
    );

    const parsed = JSON.parse(serializeSarifResult(result(findings)));
    expect(parsed.runs[0].results).toHaveLength(paths.length);
    for (const sarifResult of parsed.runs[0].results) {
      expect(sarifResult.partialFingerprints["scopeforge/v1"]).toMatch(/^sfs1:/);
      expect(sarifResult).not.toHaveProperty("locations");
    }
  });

  it("does not let input order change rule or result serialization", () => {
    const a = secretFinding();
    const b = secretFinding({
      id: `sfs1:${"9".repeat(64)}`,
      fingerprint: `sfs1:${"9".repeat(64)}`,
      ruleId: "secrets/another",
      severity: "medium",
      location: { file: "src/b.ts", startLine: 8, startColumn: 1, endLine: 8, endColumn: 2 }
    });

    expect(serializeSarifResult(result([a, b]))).toBe(serializeSarifResult(result([b, a])));
  });
});
