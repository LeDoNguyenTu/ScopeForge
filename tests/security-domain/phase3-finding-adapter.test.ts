import { describe, expect, it } from "vitest";
import type { Finding } from "@/packages/scanner-core/findings/types";
import {
  mapPhase3Finding,
  mapPhase3Validation,
} from "@/packages/security-domain-adapters/phase3";

const input: Finding = {
  id: "finding-legacy-id",
  fingerprint: "sf1:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  scanner: "jsts",
  ruleId: "jsts/command-injection",
  ruleVersion: "1.2.3",
  title: "Command injection",
  description: "Untrusted input reaches a command execution sink.",
  severity: "high",
  confidence: "high",
  category: "injection",
  validation: "static_confirmed",
  provenance: "observed",
  location: {
    file: "src/app.ts",
    startLine: 7,
    startColumn: 3,
    endLine: 7,
    endColumn: 20,
  },
  evidence: {
    summary: "Request input reaches child_process.exec.",
    redactedSnippet: "exec(<redacted>)",
    dataFlow: [
      { file: "src/app.ts", line: 4, label: "source" },
      { file: "src/app.ts", line: 7, label: "sink" },
    ],
  },
  cwe: ["CWE-78"],
  owasp: ["A03:2021"],
  references: ["https://owasp.org/www-community/attacks/Command_Injection"],
  remediation: {
    summary: "Avoid shell command construction.",
    guidance: "Use an allowlisted argument API instead of a shell string.",
    verification: "Re-run the scanner and confirm the data flow is removed.",
  },
  metadata: { privateSource: "must-not-copy" },
  baselineState: "existing",
};

describe("Phase 3 finding adapter", () => {
  it("maps deterministically without copying scanner-private detail", () => {
    const first = mapPhase3Finding(input);
    const second = mapPhase3Finding({
      ...input,
      metadata: { other: "also-not-copy" },
    });

    expect(first).toEqual(second);
    expect(first.finding.id).toBe(`phase3:${input.fingerprint}`);
    expect(first.finding.source).toEqual({
      kind: "deterministic-passive-scanner",
      sourceId: "scopeforge:jsts:jsts/command-injection",
      sourceVersion: "1.2.3",
    });
    expect(first.finding.location).toEqual({
      path: "src/app.ts",
      start: { line: 7, column: 3 },
      end: { line: 7, column: 20 },
    });
    expect(first.finding.lifecycle).toBe("open");
    expect(first.finding.provenance.kind).toBe("scanner-derived");
    expect(first.evidence).toHaveLength(1);
    expect(first.evidence[0]).toMatchObject({
      kind: "static-analysis",
      summary: "Request input reaches child_process.exec.",
      classification: "internal",
      provenance: { kind: "scanner-derived" },
    });

    const serialized = JSON.stringify(first);
    expect(serialized).not.toContain("must-not-copy");
    expect(serialized).not.toContain("also-not-copy");
    expect(serialized).not.toContain("exec(<redacted>)");
    expect(serialized).not.toContain("dataFlow");
  });

  it("maps Phase 3 validation conservatively", () => {
    expect(mapPhase3Validation("static_confirmed")).toBe("static_confirmed");
    expect(mapPhase3Validation("dependency_confirmed")).toBe("static_confirmed");
    expect(mapPhase3Validation("heuristic")).toBe("unvalidated");
    expect(mapPhase3Validation("informational")).toBe("unvalidated");
  });

  it("uses dependency evidence for dependency-confirmed findings", () => {
    const mapped = mapPhase3Finding({
      ...input,
      scanner: "sca",
      ruleId: "sca/vulnerable-dependency",
      validation: "dependency_confirmed",
      evidence: { summary: "Dependency lodash@4.17.20 matches an advisory." },
    });

    expect(mapped.evidence[0]?.kind).toBe("dependency");
    expect(mapped.finding.validation).toBe("static_confirmed");
  });
});
