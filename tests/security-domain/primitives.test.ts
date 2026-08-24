import { describe, expect, it } from "vitest";
import {
  SECURITY_DOMAIN_CONTRACT_VERSION,
  evidenceId,
  securityFindingId,
  type FindingSourceRef,
  type ProvenanceRecord,
} from "@/packages/security-domain";

describe("security-domain primitives", () => {
  it("exposes a versioned framework-independent contract", () => {
    expect(SECURITY_DOMAIN_CONTRACT_VERSION).toBe(1);
    expect(String(securityFindingId("sfinding:abc"))).toBe("sfinding:abc");
    expect(String(evidenceId("evidence:abc"))).toBe("evidence:abc");
  });

  it("rejects empty opaque identifiers", () => {
    expect(() => securityFindingId("  ")).toThrow(/non-empty/i);
  });

  it("keeps source and provenance as separate concepts", () => {
    const provenance: ProvenanceRecord = { kind: "scanner-derived" };
    const source: FindingSourceRef = {
      kind: "deterministic-passive-scanner",
      sourceId: "scopeforge:secrets",
      sourceVersion: "1",
    };

    expect(provenance.kind).not.toBe(source.kind);
  });
});
