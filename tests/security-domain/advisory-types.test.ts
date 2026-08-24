import { describe, expect, it } from "vitest";
import {
  assetRef,
  buildAdvisoryContext,
  relationshipId,
  securityFindingId,
  type AdvisoryContextItem,
  type AdvisoryRelationshipSuggestion,
  type AdvisoryRequest,
} from "@/packages/security-domain";

const rawContext: readonly AdvisoryContextItem[] = [
  {
    id: "finding:1",
    kind: "finding",
    summary: "Normalized finding summary",
    classification: "internal",
  },
];

describe("advisory type boundary", () => {
  it("accepts only policy-prepared context in advisory requests", () => {
    const preparedContext = buildAdvisoryContext(rawContext, {
      execution: "local",
      allowSensitiveRemote: false,
      maxItems: 10,
      maxCharacters: 1000,
    });

    const request: AdvisoryRequest = {
      purpose: "explain-finding",
      context: preparedContext,
    };

    expect(request.context).toHaveLength(1);

    const unsafeRequest: AdvisoryRequest = {
      purpose: "explain-finding",
      // @ts-expect-error Raw context must pass through buildAdvisoryContext first.
      context: rawContext,
    };

    void unsafeRequest;
  });

  it("keeps relationship suggestions inferred at the type boundary", () => {
    const suggestion: AdvisoryRelationshipSuggestion = {
      id: relationshipId("relationship:1"),
      type: "can_lead_to",
      from: { kind: "finding", ref: securityFindingId("finding:1") },
      to: { kind: "asset", ref: assetRef("asset:1") },
      provenance: { kind: "inferred" },
      confidence: "medium",
    };

    expect(suggestion.provenance.kind).toBe("inferred");

    const invalidSuggestion: AdvisoryRelationshipSuggestion = {
      ...suggestion,
      // @ts-expect-error Advisory relationship suggestions cannot claim observed provenance.
      provenance: { kind: "observed" },
    };

    void invalidSuggestion;
  });
});
