import { describe, expect, it } from "vitest";

import { parsePublicationEvidence } from "@/packages/validation-publication";
import { evidenceFixture } from "./fixtures";

describe("Phase 8C publication provenance", () => {
  it("requires exact Phase 8A and Phase 8B commit plus tree identities", () => {
    const fixture = evidenceFixture();
    fixture.source.phase8aTree = "aa6d94c2a35973ee2c8ccbc038d22d7de4f48cc8";
    const parsed = parsePublicationEvidence(JSON.stringify(fixture));
    expect(parsed.source).toMatchObject({
      phase8aCommit: "8d766f5969427a2e4525f5232b5e28b0f93675bd",
      phase8aTree: "aa6d94c2a35973ee2c8ccbc038d22d7de4f48cc8",
      phase8bCommit: "226a20739871c15d0262d1779b3b013520f47fc6",
      phase8bTree: "50f17f44e770f1179ed2b40b7713e14e864958c0",
    });
  });
});
