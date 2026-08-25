import { describe, expect, it } from "vitest";

import type { Finding, ScanResult } from "@/packages/scanner-core/findings/types";
import {
  createHostedEvidenceIdentity,
  createHostedFindingIdentity,
} from "@/packages/scanner-output/hosted/identity";
import { serializeHostedScanResult } from "@/packages/scanner-output/hosted/serialize";

function finding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: "legacy-id",
    fingerprint: "sf1:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    scanner: "jsts",
    ruleId: "jsts/command-injection",
    ruleVersion: "1.2.3",
    title: "Command injection",
    description: "Untrusted input reaches command execution.",
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
      summary: "Request input reaches a command execution sink.",
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
      guidance: "Use an argument API rather than a shell string.",
      verification: "Re-run ScopeForge and confirm the data flow is removed.",
    },
    metadata: { privateSource: "must-not-cross-hosted-boundary" },
    baselineState: "new",
    ...overrides,
  };
}

function result(findings: Finding[]): ScanResult {
  return {
    scan: {
      root: "/Users/brian/private/project",
      startedAt: "2026-08-26T00:00:00.000Z",
      durationMs: 42,
      scanners: ["jsts@1.0.0", "secrets@1.0.0"],
    },
    inventory: {
      filesAnalyzed: 12,
      filesSkipped: 2,
      totalBytes: 4096,
      languages: { TypeScript: 12 },
      manifests: ["package.json"],
      infrastructure: [],
      skippedByReason: {
        default_exclude: 1,
        gitignore: 1,
        scopeforgeignore: 0,
        symlink: 0,
        file_too_large: 0,
        file_limit: 0,
        total_bytes_limit: 0,
        unreadable: 0,
      },
    },
    findings,
    errors: [
      {
        scanner: "jsts",
        code: "syntax_error",
        file: "src/private.ts",
        message: "private diagnostic text",
      },
    ],
    policy: { mode: "report-only", passed: false },
  };
}

describe("hosted Phase 3 export", () => {
  it("emits a deterministic privacy-reduced v1 envelope", () => {
    const first = serializeHostedScanResult(result([finding()]), {
      toolVersion: "0.1.0",
      repositoryUrl: "https://github.com/LeDoNguyenTu/ScopeForge",
    });
    const second = serializeHostedScanResult(result([finding()]), {
      toolVersion: "0.1.0",
      repositoryUrl: "https://github.com/LeDoNguyenTu/ScopeForge",
    });

    expect(first).toBe(second);
    const parsed = JSON.parse(first);
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.repository).toEqual({
      canonicalUrl: "https://github.com/LeDoNguyenTu/ScopeForge",
    });
    expect(parsed.scan).toMatchObject({
      startedAt: "2026-08-26T00:00:00.000Z",
      durationMs: 42,
      scannerErrorCount: 1,
    });
    expect(parsed.inventory).toEqual({ filesAnalyzed: 12, filesSkipped: 2, totalBytes: 4096 });
    expect(parsed.findings).toHaveLength(1);
    expect(parsed.findings[0]).toMatchObject({
      fingerprint: finding().fingerprint,
      scanner: "jsts",
      ruleId: "jsts/command-injection",
      ruleVersion: "1.2.3",
      evidence: { summary: "Request input reaches a command execution sink." },
      location: { path: "src/app.ts", line: 7, startColumn: 3, endColumn: 20 },
    });
    expect(parsed.runRef).toMatch(/^sfh1:[a-f0-9]{64}$/);

    const serialized = JSON.stringify(parsed);
    expect(serialized).not.toContain("/Users/brian/private/project");
    expect(serialized).not.toContain("must-not-cross-hosted-boundary");
    expect(serialized).not.toContain("exec(<redacted>)");
    expect(serialized).not.toContain("dataFlow");
    expect(serialized).not.toContain("private diagnostic text");
    expect(serialized).not.toContain("src/private.ts");
  });

  it("does not expose secret span length or scanner-provided secret summary text", () => {
    const secret = finding({
      fingerprint: `sfs1:${"d".repeat(64)}`,
      scanner: "secrets",
      ruleId: "secrets/github-token",
      ruleVersion: "1.0.0",
      category: "secrets",
      location: {
        file: "src/config.ts",
        startLine: 4,
        startColumn: 20,
        endLine: 4,
        endColumn: 60,
      },
      evidence: {
        summary: "Regression leak: ghp_RAW_SECRET_MUST_NOT_CROSS",
        redactedSnippet: "assignment:token: ghp_…REDACTED",
      },
      metadata: { provider: "github", secretLength: 40 },
    });

    const parsed = JSON.parse(serializeHostedScanResult(result([secret]), {
      toolVersion: "0.1.0",
      repositoryUrl: "https://github.com/example/repo",
    }));

    expect(parsed.findings[0].location).toEqual({ path: "src/config.ts", line: 4 });
    expect(parsed.findings[0].evidence).toEqual({ summary: "Detected by secrets/github-token." });
    expect(JSON.stringify(parsed)).not.toContain("secretLength");
    expect(JSON.stringify(parsed)).not.toContain("REDACTED");
    expect(JSON.stringify(parsed)).not.toContain("RAW_SECRET_MUST_NOT_CROSS");
  });

  it("rekeys local secret fingerprints using only safe hosted rule and location identity", () => {
    const baseSecret = finding({
      fingerprint: `sfs1:${"1".repeat(64)}`,
      scanner: "secrets",
      ruleId: "secrets/github-token",
      ruleVersion: "1.0.0",
      category: "secrets",
      location: {
        file: "src/config.ts",
        startLine: 4,
        startColumn: 20,
        endLine: 4,
        endColumn: 60,
      },
      evidence: {
        summary: "Detected by secrets/github-token.",
        redactedSnippet: "assignment:token: ghp_…REDACTED",
      },
      metadata: { provider: "github", secretLength: 40 },
    });
    const rotatedSecret = {
      ...baseSecret,
      fingerprint: `sfs1:${"2".repeat(64)}`,
    };

    const first = JSON.parse(serializeHostedScanResult(result([baseSecret]), {
      toolVersion: "0.1.0",
      repositoryUrl: "https://github.com/example/repo",
    }));
    const second = JSON.parse(serializeHostedScanResult(result([rotatedSecret]), {
      toolVersion: "0.1.0",
      repositoryUrl: "https://github.com/example/repo",
    }));

    expect(first.findings[0].fingerprint).toMatch(/^sfs1:[a-f0-9]{64}$/);
    expect(first.findings[0].fingerprint).not.toBe(baseSecret.fingerprint);
    expect(second.findings[0].fingerprint).not.toBe(rotatedSecret.fingerprint);
    expect(second.findings[0].fingerprint).toBe(first.findings[0].fingerprint);
  });

  it("rejects imports larger than the 500-finding hosted boundary", () => {
    const findings = Array.from({ length: 501 }, (_, index) => finding({
      id: `id-${index}`,
      fingerprint: `sf1:${index.toString(16).padStart(64, "0")}`,
      location: { file: `src/${index}.ts`, startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 },
    }));

    expect(() => serializeHostedScanResult(result(findings), {
      toolVersion: "0.1.0",
      repositoryUrl: "https://github.com/example/repo",
    })).toThrow("Hosted ScopeForge imports support at most 500 findings.");
  });

  it("namespaces hosted finding identity by repository asset and source version", () => {
    const base = {
      repositoryAssetId: "11111111-1111-1111-1111-111111111111",
      fingerprint: finding().fingerprint,
      scanner: "jsts",
      ruleId: "jsts/command-injection",
      ruleVersion: "1.2.3",
    };

    const first = createHostedFindingIdentity(base);
    expect(first).toMatch(/^phase3:[a-f0-9]{64}$/);
    expect(createHostedFindingIdentity({ ...base, repositoryAssetId: "22222222-2222-2222-2222-222222222222" })).not.toBe(first);
    expect(createHostedFindingIdentity({ ...base, ruleVersion: "1.2.4" })).not.toBe(first);
  });

  it("makes immutable evidence identity content-sensitive", () => {
    const base = {
      findingId: "phase3:" + "a".repeat(64),
      kind: "static-analysis" as const,
      classification: "internal" as const,
      summary: "Safe evidence summary",
    };

    const first = createHostedEvidenceIdentity(base);
    expect(first).toMatch(/^phase3-evidence:[a-f0-9]{64}$/);
    expect(createHostedEvidenceIdentity({ ...base, summary: "Updated safe evidence summary" })).not.toBe(first);
  });
});