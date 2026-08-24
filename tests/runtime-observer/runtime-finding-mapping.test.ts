import { describe, expect, it } from "vitest";
import { assetRef } from "@/packages/security-domain";
import {
  evaluateRuntimeRules,
  mapRuntimeRuleMatchToEvidence,
  mapRuntimeRuleMatchToSecurityFinding,
  type RuntimeObservation,
} from "@/packages/runtime-observer";

const runtimeAssetRef = assetRef("asset-1");

function header(name: string, present: boolean, value?: string): RuntimeObservation {
  return value === undefined
    ? { kind: "header", name, present }
    : { kind: "header", name, present, value };
}

describe("deterministic runtime rules", () => {
  it("reports missing HSTS as configuration hardening without exploit claims", () => {
    const matches = evaluateRuntimeRules({
      observations: [header("strict-transport-security", false)],
    });

    expect(matches.map((match) => match.ruleId)).toContain("runtime/http/missing-hsts");
    const serialized = JSON.stringify(matches).toLowerCase();
    expect(serialized).not.toContain("exploitable");
    expect(serialized).not.toContain("exploitation");
  });

  it("does not report missing HSTS when it is present", () => {
    const matches = evaluateRuntimeRules({
      observations: [header("strict-transport-security", true, "max-age=31536000")],
    });

    expect(matches.map((match) => match.ruleId)).not.toContain("runtime/http/missing-hsts");
  });

  it("reports a missing or incorrect nosniff policy", () => {
    const missing = evaluateRuntimeRules({
      observations: [header("x-content-type-options", false)],
    });
    const incorrect = evaluateRuntimeRules({
      observations: [header("x-content-type-options", true, "other")],
    });

    expect(missing.map((match) => match.ruleId)).toContain("runtime/http/missing-nosniff");
    expect(incorrect.map((match) => match.ruleId)).toContain("runtime/http/missing-nosniff");
  });

  it("reports HTTPS cookies missing Secure", () => {
    const matches = evaluateRuntimeRules({
      observations: [{ kind: "cookie", name: "prefs", secure: false, httpOnly: false, sameSite: "Lax" }],
    });

    expect(matches.map((match) => match.ruleId)).toContain("runtime/cookie/missing-secure");
  });

  it("reports session-like cookies missing HttpOnly", () => {
    const matches = evaluateRuntimeRules({
      observations: [{ kind: "cookie", name: "session_id", secure: true, httpOnly: false, sameSite: "Lax" }],
    });

    expect(matches.map((match) => match.ruleId)).toContain("runtime/cookie/session-missing-httponly");
  });

  it("reports an expired certificate using an injected deterministic clock", () => {
    const matches = evaluateRuntimeRules({
      observations: [{
        kind: "tls",
        protocol: "TLSv1.3",
        validFrom: "Jan 01 00:00:00 2025 GMT",
        validTo: "Jan 01 00:00:00 2026 GMT",
        sanCount: 1,
        hostnameMatches: true,
      }],
      now: new Date("2026-08-25T00:00:00Z"),
    });

    expect(matches.map((match) => match.ruleId)).toContain("runtime/tls/certificate-expired");
  });
});

describe("runtime security-domain mapping", () => {
  it("maps deterministically into observed security-domain records", () => {
    const match = evaluateRuntimeRules({
      observations: [header("strict-transport-security", false)],
    })[0];
    expect(match).toBeDefined();
    if (!match) return;

    const first = mapRuntimeRuleMatchToSecurityFinding({ assetRef: runtimeAssetRef, match });
    const second = mapRuntimeRuleMatchToSecurityFinding({ assetRef: runtimeAssetRef, match });
    const evidence = mapRuntimeRuleMatchToEvidence({ assetRef: runtimeAssetRef, match });

    expect(first).toEqual(second);
    expect(first.source).toEqual({
      kind: "deterministic-runtime-scanner",
      sourceId: "scopeforge:runtime-observer",
      sourceVersion: "0.1",
    });
    expect(first.assetRef).toBe(runtimeAssetRef);
    expect(first.validation).toBe("runtime_observed");
    expect(first.provenance.kind).toBe("scanner-derived");
    expect(first.provenance.kind).not.toBe("inferred");
    expect(first.evidenceRefs).toEqual([evidence.id]);
    expect(evidence.kind).toBe("http-observation");
    expect(evidence.classification).toBe("public");
    expect(evidence.provenance.kind).toBe("observed");
    expect(evidence.summary.length).toBeLessThanOrEqual(4_096);
  });

  it("changes the deterministic identity when the asset changes", () => {
    const match = evaluateRuntimeRules({
      observations: [header("strict-transport-security", false)],
    })[0];
    expect(match).toBeDefined();
    if (!match) return;

    const first = mapRuntimeRuleMatchToSecurityFinding({ assetRef: runtimeAssetRef, match });
    const second = mapRuntimeRuleMatchToSecurityFinding({ assetRef: assetRef("asset-2"), match });

    expect(first.id).not.toBe(second.id);
  });
});
