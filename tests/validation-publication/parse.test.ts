import { describe, expect, it } from "vitest";

import { parsePublicationEvidence } from "@/packages/validation-publication";
import { evidenceFixture } from "./fixtures";

describe("Phase 8C publication evidence parser", () => {
  it("accepts the exact v1 evidence shape", () => {
    const parsed = parsePublicationEvidence(JSON.stringify(evidenceFixture()));
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.publicationId).toBe("scopeforge-phase-8-release-v1");
    expect(parsed.performance.profiles).toHaveLength(3);
  });

  it("rejects unsupported schemas and unknown top-level keys", () => {
    expect(() => parsePublicationEvidence(JSON.stringify({ ...evidenceFixture(), schemaVersion: 2 }))).toThrow();
    expect(() => parsePublicationEvidence(JSON.stringify({ ...evidenceFixture(), extra: true }))).toThrow();
  });

  it("rejects malformed git identities", () => {
    const fixture = evidenceFixture();
    fixture.source.phase8bCommit = "abc";
    expect(() => parsePublicationEvidence(JSON.stringify(fixture))).toThrow();
  });

  it("rejects duplicate object keys before JSON parsing", () => {
    const raw = JSON.stringify(evidenceFixture()).replace(
      '"publicationId":"scopeforge-phase-8-release-v1"',
      '"publicationId":"scopeforge-phase-8-release-v1","publicationId":"duplicate"',
    );
    expect(() => parsePublicationEvidence(raw)).toThrow();
  });

  it("rejects evidence larger than the fixed byte budget", () => {
    const fixture = evidenceFixture();
    fixture.limitations = ["x".repeat((512 * 1024) + 1)];
    expect(() => parsePublicationEvidence(JSON.stringify(fixture))).toThrow();
  });

  it("rejects absolute private paths in reproduction commands", () => {
    const fixture = evidenceFixture();
    fixture.reproduction.render = "node /Users/private-user/render.js";
    expect(() => parsePublicationEvidence(JSON.stringify(fixture))).toThrow();
  });
});
