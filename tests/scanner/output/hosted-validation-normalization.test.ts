import { describe, expect, it } from "vitest";

import type { Finding, ScanResult, Validation } from "@/packages/scanner-core/findings/types";
import { serializeHostedScanResult } from "@/packages/scanner-output/hosted/serialize";

function finding(validation: Validation): Finding {
  return {
    id: "legacy-id",
    fingerprint: "sf1:" + "a".repeat(64),
    scanner: "jsts",
    ruleId: "jsts/command-injection",
    ruleVersion: "1.0.0",
    title: "Command injection",
    description: "Untrusted input reaches command execution.",
    severity: "high",
    confidence: "high",
    category: "injection",
    validation,
    provenance: "observed",
    location: { file: "src/app.ts", startLine: 7, startColumn: 3, endLine: 7, endColumn: 20 },
    evidence: { summary: "Request input reaches a command execution sink." },
    cwe: ["CWE-78"],
    owasp: ["A03:2021"],
    references: [],
    remediation: { summary: "Fix it.", guidance: "Avoid shell strings.", verification: "Rescan." },
    metadata: {},
    baselineState: "new",
  };
}

function result(validation: Validation): ScanResult {
  return {
    scan: { root: "/private/root", startedAt: "2026-08-26T00:00:00.000Z", durationMs: 1, scanners: ["jsts@1.0.0"] },
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
        unreadable: 0,
      },
    },
    findings: [finding(validation)],
    errors: [],
    policy: { mode: "report-only", passed: true },
  };
}

function hostedValidation(validation: Validation): string {
  const envelope = JSON.parse(serializeHostedScanResult(result(validation), {
    toolVersion: "0.1.0",
    repositoryUrl: "https://github.com/example/repo",
  }));
  return envelope.findings[0].validation;
}

describe("hosted Phase 3 validation normalization", () => {
  it("maps deterministic local confirmations to static_confirmed", () => {
    expect(hostedValidation("static_confirmed")).toBe("static_confirmed");
    expect(hostedValidation("dependency_confirmed")).toBe("static_confirmed");
  });

  it("maps heuristic and informational local findings to unvalidated", () => {
    expect(hostedValidation("heuristic")).toBe("unvalidated");
    expect(hostedValidation("informational")).toBe("unvalidated");
  });
});
