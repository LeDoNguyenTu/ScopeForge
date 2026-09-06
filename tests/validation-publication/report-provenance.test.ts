import { describe, expect, it } from "vitest";

import {
  normalizePublicationEvidence,
  renderTechnicalPublicationMarkdown,
} from "@/packages/validation-publication";
import { evidenceFixture } from "./fixtures";

describe("Phase 8C report provenance rendering", () => {
  it("prints both accepted evidence commit and tree identities", () => {
    const report = renderTechnicalPublicationMarkdown(
      normalizePublicationEvidence(evidenceFixture()),
    );
    expect(report).toContain("8d766f5969427a2e4525f5232b5e28b0f93675bd");
    expect(report).toContain("aa6d94c2a35973ee2c8ccbc038d22d7de4f48cc8");
    expect(report).toContain("226a20739871c15d0262d1779b3b013520f47fc6");
    expect(report).toContain("50f17f44e770f1179ed2b40b7713e14e864958c0");
  });
});
