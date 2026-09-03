import { describe, expect, it } from "vitest";

import type {
  SecurityPackManifestV1,
  SecurityPackRuleV1,
} from "@/packages/security-packs/contracts";
import { createSecurityPackFinding } from "@/packages/security-packs/finding";
import type { SecurityPackLiteralMatch } from "@/packages/security-packs/literal-matcher";

const rule: SecurityPackRuleV1 = {
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
    attack: ["T1557"],
    nistCsf: ["PR.DS-2"],
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
  preparedness: ["Use managed trust stores."],
  falsePositiveNotes: ["Reviewed test-only fixtures may be excluded explicitly."],
  matcher: {
    include: ["**/Dockerfile*"],
    exclude: ["**/test-fixtures/**"],
    mode: "any",
    literals: ["NODE_TLS_REJECT_UNAUTHORIZED=0"],
    absentLiterals: ["scopeforge-reviewed-test-only"],
    caseSensitive: true,
  },
};

const pack: SecurityPackManifestV1 = {
  schemaVersion: 1,
  packId: "org.scopeforge.example",
  version: "1.0.0",
  name: "ScopeForge Example Pack",
  summary: "Example local static rules.",
  license: "MIT",
  repository: "https://github.com/scopeforge/example-pack",
  maintainers: ["scopeforge"],
  safety: "static",
  minimumScopeForgeVersion: "0.1.0",
  rules: [rule],
};

const match: SecurityPackLiteralMatch = {
  byteOffset: 12,
  byteLength: Buffer.byteLength("NODE_TLS_REJECT_UNAUTHORIZED=0", "utf8"),
  literalOrdinal: 0,
  startLine: 2,
  startColumn: 1,
  endLine: 2,
  endColumn: 31,
};

describe("Security Pack finding construction", () => {
  it("creates a deterministic normalized finding without literal or source leakage", () => {
    const first = createSecurityPackFinding({ pack, rule, file: "Dockerfile", match });
    const second = createSecurityPackFinding({ pack, rule, file: "Dockerfile", match });

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      scanner: "security-pack",
      ruleId: "pack/org.scopeforge.example/node/tls-disabled",
      ruleVersion: "1.0.0",
      title: "TLS verification disabled",
      description: rule.description,
      severity: "high",
      confidence: "high",
      category: "transport-security",
      validation: "static_confirmed",
      provenance: "observed",
      location: {
        file: "Dockerfile",
        startLine: 2,
        startColumn: 1,
        endLine: 2,
        endColumn: 31,
      },
      cwe: ["CWE-295"],
      owasp: ["A02:2021"],
      references: [],
      remediation: rule.remediation,
      metadata: {
        packId: "org.scopeforge.example",
        packVersion: "1.0.0",
        matcher: "static_literal_v1",
      },
      baselineState: "new",
    });
    expect(first.id).toBe(first.fingerprint);
    expect(first.fingerprint).toMatch(/^sf1:[a-f0-9]{64}$/);

    const serialized = JSON.stringify(first);
    expect(serialized).not.toContain("NODE_TLS_REJECT_UNAUTHORIZED=0");
    expect(serialized).not.toContain("scopeforge-reviewed-test-only");
    expect(serialized).not.toContain("T1557");
    expect(serialized).not.toContain("PR.DS-2");
  });

  it("binds the fingerprint to pack version, rule version, file, byte offset, and literal ordinal", () => {
    const original = createSecurityPackFinding({ pack, rule, file: "Dockerfile", match });
    const moved = createSecurityPackFinding({
      pack,
      rule,
      file: "Dockerfile",
      match: { ...match, byteOffset: match.byteOffset + 1 },
    });
    const nextPackVersion = createSecurityPackFinding({
      pack: { ...pack, version: "1.0.1" },
      rule,
      file: "Dockerfile",
      match,
    });

    expect(moved.fingerprint).not.toBe(original.fingerprint);
    expect(nextPackVersion.fingerprint).not.toBe(original.fingerprint);
  });
});
