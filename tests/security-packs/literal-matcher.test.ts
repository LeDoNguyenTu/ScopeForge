import { describe, expect, it } from "vitest";

import type { SecurityPackRuleV1 } from "@/packages/security-packs/contracts";
import { matchStaticLiteral } from "@/packages/security-packs/literal-matcher";

function rule(
  matcher: Partial<SecurityPackRuleV1["matcher"]> = {},
): SecurityPackRuleV1 {
  return {
    id: "node/tls-disabled",
    version: "1.0.0",
    kind: "static_literal_v1",
    title: "TLS verification disabled",
    summary: "Detects disabled TLS verification.",
    description: "TLS verification must remain enabled outside reviewed test fixtures.",
    severity: "high",
    confidence: "high",
    category: "transport-security",
    mappings: {
      cwe: ["CWE-295"],
      owasp: ["A02:2021"],
      attack: [],
      nistCsf: [],
    },
    explanations: {
      plain: "TLS verification is disabled.",
      developer: "Keep certificate verification enabled.",
      security: "Disabling verification permits machine-in-the-middle attacks.",
    },
    remediation: {
      summary: "Enable TLS verification.",
      guidance: "Remove the unsafe override and use a trusted CA chain.",
      verification: "Re-run the scan and confirm the rule no longer matches.",
    },
    preparedness: [],
    falsePositiveNotes: [],
    matcher: {
      include: ["**"],
      exclude: [],
      mode: "any",
      literals: ["unsafe"],
      absentLiterals: [],
      caseSensitive: true,
      ...matcher,
    },
  };
}

function match(ruleValue: SecurityPackRuleV1, file: string, text: string) {
  return matchStaticLiteral(ruleValue, file, Buffer.from(text, "utf8"));
}

describe("Security Pack static literal matcher", () => {
  it("implements any, all, absent, earliest-byte, CRLF, and ASCII-only case behavior", () => {
    expect(match(rule({ mode: "any", literals: ["beta", "alpha"] }), "x.txt", "alpha beta")).toMatchObject({
      byteOffset: 0,
      literalOrdinal: 1,
      startLine: 1,
      startColumn: 1,
    });
    expect(match(rule({ mode: "all", literals: ["alpha", "beta"] }), "x.txt", "beta\r\nalpha")).toMatchObject({
      byteOffset: 0,
      literalOrdinal: 1,
    });
    expect(match(rule({ literals: ["unsafe"], absentLiterals: ["reviewed"] }), "x.txt", "unsafe reviewed")).toBeNull();
    expect(match(rule({ literals: ["TOKEN"], caseSensitive: false }), "x.txt", "token")).toMatchObject({
      byteOffset: 0,
    });
    expect(() => match(rule({ literals: ["TÖKEN"], caseSensitive: false }), "x.txt", "töken")).toThrowError(
      expect.objectContaining({ code: "PACK_MANIFEST_INVALID" }),
    );
  });

  it("respects include and exclude path patterns", () => {
    const matchedRule = rule({
      include: ["**/Dockerfile*"],
      exclude: ["**/test-fixtures/**"],
      literals: ["unsafe"],
    });

    expect(match(matchedRule, "Dockerfile", "unsafe")).not.toBeNull();
    expect(match(matchedRule, "services/api/Dockerfile.dev", "unsafe")).not.toBeNull();
    expect(match(matchedRule, "test-fixtures/Dockerfile", "unsafe")).toBeNull();
    expect(match(matchedRule, "src/index.ts", "unsafe")).toBeNull();
  });

  it("reports one-based byte locations while preserving CR bytes", () => {
    expect(match(rule({ literals: ["target"] }), "x.txt", "one\r\ntarget")).toMatchObject({
      byteOffset: 5,
      byteLength: 6,
      startLine: 2,
      startColumn: 1,
      endLine: 2,
      endColumn: 7,
    });
  });

  it("never returns the matched literal or source bytes", () => {
    const result = match(rule({ literals: ["RAW_SENTINEL"] }), "x.txt", "RAW_SENTINEL");
    expect(result).not.toBeNull();
    expect(JSON.stringify(result)).not.toContain("RAW_SENTINEL");
  });
});
