import { describe, expect, it } from "vitest";

import {
  normalizePublicationEvidence,
  parsePublicationEvidence,
  renderTechnicalPublicationMarkdown,
  serializeTechnicalPublicationJson,
} from "@/packages/validation-publication";
import { evidenceFixture } from "./fixtures";

describe("Phase 8C publication privacy", () => {
  it("does not add timestamps, working directories, source snippets, or secret material", () => {
    const normalized = normalizePublicationEvidence(evidenceFixture() as any);
    const json = serializeTechnicalPublicationJson(normalized);
    const markdown = renderTechnicalPublicationMarkdown(normalized);

    for (const forbidden of [
      "/Users/private-user",
      "C:\\Users\\private-user",
      "SYNTHETIC_SECRET_SENTINEL",
      "sourceSnippet",
      "findingEvidence",
      "publishedAt",
      "generatedAt",
    ]) {
      expect(json).not.toContain(forbidden);
      expect(markdown).not.toContain(forbidden);
    }
  });

  it("fails closed before rendering evidence containing private absolute paths", () => {
    const fixture = evidenceFixture();
    fixture.reproduction.render = "node C:\\Users\\private-user\\render.js";
    expect(() => parsePublicationEvidence(JSON.stringify(fixture))).toThrow();
  });

  it("keeps the corpus-scope, benchmark-SLO, and memory boundaries in both formats", () => {
    const normalized = normalizePublicationEvidence(evidenceFixture() as any);
    const json = serializeTechnicalPublicationJson(normalized);
    const markdown = renderTechnicalPublicationMarkdown(normalized);

    for (const boundary of [
      normalized.claimBoundaries.accuracyScope,
      normalized.claimBoundaries.latency,
      normalized.claimBoundaries.memory,
      normalized.claimBoundaries.authority,
    ]) {
      expect(json).toContain(boundary);
      expect(markdown).toContain(boundary);
    }
  });
});
