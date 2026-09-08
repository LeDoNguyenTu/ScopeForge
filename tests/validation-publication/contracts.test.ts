import { describe, expect, it } from "vitest";

import {
  PUBLICATION_EVIDENCE_LIMITS,
  PublicationEvidenceError,
} from "@/packages/validation-publication";

describe("Phase 8C publication contracts", () => {
  it("locks v1 evidence budgets and stable error identity", () => {
    expect(PUBLICATION_EVIDENCE_LIMITS).toEqual({
      evidenceBytes: 512 * 1024,
      narrativeBytes: 4 * 1024,
      listItems: 256,
      profiles: 16,
      rules: 256,
      cases: 1024,
    });

    const error = new PublicationEvidenceError(
      "PUBLICATION_EVIDENCE_INVALID",
      "invalid evidence",
      "source.phase8bCommit",
    );
    expect(error.code).toBe("PUBLICATION_EVIDENCE_INVALID");
    expect(error.field).toBe("source.phase8bCommit");
    expect(error.message).toBe("invalid evidence");
  });
});
