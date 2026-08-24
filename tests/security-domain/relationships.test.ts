import { describe, expect, expectTypeOf, it } from "vitest";
import {
  relationshipId,
  securityFindingId,
  type AdvisoryResult,
  type RiskRelationship,
} from "@/packages/security-domain";

describe("risk relationship contracts", () => {
  it("keeps relationship provenance explicit", () => {
    const relationship: RiskRelationship = {
      id: relationshipId("relationship:1"),
      type: "can_lead_to",
      from: { kind: "finding", ref: securityFindingId("finding:1") },
      to: { kind: "consequence", ref: "customer-data-risk" },
      provenance: { kind: "inferred", rationale: "bounded relationship hypothesis" },
      confidence: "medium",
    };

    expect(relationship.provenance.kind).toBe("inferred");
  });

  it("types advisory results as inferred-only provenance", () => {
    expectTypeOf<AdvisoryResult["provenance"]>().toEqualTypeOf<{
      kind: "inferred";
      rationale?: string;
    }>();
  });
});
