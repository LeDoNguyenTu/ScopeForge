import { describe, expect, it } from "vitest";
import type { AssetRef } from "@/packages/security-domain";
import { SCOPEFORGE_SYNTHETIC_ORIGIN } from "@/packages/runtime-network";
import {
  evaluateCorsPolicyRules,
  mapActiveRuntimeRuleMatchToEvidence,
  mapActiveRuntimeRuleMatchToSecurityFinding,
  type CorsPolicyObservation,
} from "@/packages/runtime-validator";

const assetRef = "asset:test-web" as AssetRef;

function observation(
  overrides: Partial<CorsPolicyObservation> = {},
): CorsPolicyObservation {
  return {
    kind: "cors-policy",
    url: "https://example.com/app",
    status: 200,
    allowedOrigin: SCOPEFORGE_SYNTHETIC_ORIGIN,
    credentialsAllowed: false,
    variesOnOrigin: true,
    ...overrides,
  };
}

describe("deterministic active CORS findings", () => {
  it("reports credentialed allowance of the synthetic untrusted origin as high confidence", () => {
    const matches = evaluateCorsPolicyRules({
      observation: observation({ credentialsAllowed: true }),
    });

    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      ruleId: "cors-credentialed-untrusted-origin",
      severity: "high",
      confidence: "high",
    });
    expect(matches[0]?.description.toLowerCase()).toContain("policy");
    expect(matches[0]?.description.toLowerCase()).not.toContain("data was stolen");
  });

  it("reports exact synthetic-origin allowance without credentials conservatively as low severity", () => {
    const matches = evaluateCorsPolicyRules({ observation: observation() });

    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      ruleId: "cors-untrusted-origin-allowed",
      severity: "low",
      confidence: "high",
    });
  });

  it("keeps wildcard and missing Vary as observations rather than active findings", () => {
    expect(evaluateCorsPolicyRules({
      observation: observation({ allowedOrigin: "*", credentialsAllowed: false }),
    })).toEqual([]);
    expect(evaluateCorsPolicyRules({
      observation: observation({ allowedOrigin: null, variesOnOrigin: false }),
    })).toEqual([]);
  });

  it("maps active matches into the shared security domain with stable runtime_validated identities", () => {
    const match = evaluateCorsPolicyRules({
      observation: observation({ credentialsAllowed: true }),
    })[0];
    expect(match).toBeDefined();
    if (!match) return;

    const firstEvidence = mapActiveRuntimeRuleMatchToEvidence({ assetRef, match });
    const secondEvidence = mapActiveRuntimeRuleMatchToEvidence({ assetRef, match });
    const firstFinding = mapActiveRuntimeRuleMatchToSecurityFinding({ assetRef, match });
    const secondFinding = mapActiveRuntimeRuleMatchToSecurityFinding({ assetRef, match });

    expect(firstEvidence).toEqual(secondEvidence);
    expect(firstFinding).toEqual(secondFinding);
    expect(firstEvidence.kind).toBe("http-observation");
    expect(firstEvidence.summary.length).toBeLessThanOrEqual(4_096);
    expect(firstFinding).toMatchObject({
      validation: "runtime_validated",
      source: {
        kind: "deterministic-runtime-scanner",
        sourceId: "scopeforge:runtime-validator",
        sourceVersion: "cors-origin-policy@1",
      },
      severity: "high",
      confidence: "high",
      lifecycle: "open",
    });
    expect(firstFinding.evidenceRefs).toEqual([firstEvidence.id]);
  });
});
