import { describe, expect, it } from "vitest";

import { SECURITY_PACK_LIMITS, SecurityPackError } from "@/packages/security-packs";

describe("Security Pack v1 contracts", () => {
  it("exposes immutable v1 resource ceilings and stable error metadata", () => {
    expect(Object.isFrozen(SECURITY_PACK_LIMITS)).toBe(true);
    expect(SECURITY_PACK_LIMITS).toEqual({
      manifestBytes: 256 * 1024,
      rulesPerPack: 100,
      selectedPacks: 10,
      selectedRules: 500,
      includePatternsPerRule: 16,
      excludePatternsPerRule: 16,
      literalsPerRule: 16,
      literalBytes: 256,
      fixtureCasesPerRule: 20,
      fixtureFilesPerCase: 100,
      fixtureBytesPerCase: 1024 * 1024,
      findingsPerPack: 1000,
      guidanceFieldBytes: 8 * 1024,
    });

    const error = new SecurityPackError(
      "PACK_IDENTITY_INVALID",
      "packId is invalid.",
      "packId",
    );
    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({
      name: "SecurityPackError",
      code: "PACK_IDENTITY_INVALID",
      field: "packId",
    });
  });
});
