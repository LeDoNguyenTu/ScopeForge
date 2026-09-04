import { afterEach, describe, expect, it } from "vitest";

import { loadSecurityPackManifest } from "@/packages/security-packs/parse";
import { validateSecurityPackFixtures } from "@/packages/security-packs/fixtures";
import {
  DEFAULT_TASK5_CASES,
  cleanupTask5Roots,
  createTask5Pack,
  snapshotTask5Tree,
  type FixtureCaseInput,
} from "./task5-helpers";

afterEach(cleanupTask5Roots);

function caseById(caseId: string): FixtureCaseInput {
  const fixtureCase = DEFAULT_TASK5_CASES.find((candidate) => candidate.caseId === caseId);
  if (!fixtureCase) throw new Error(`Missing test fixture case: ${caseId}`);
  return fixtureCase;
}

describe("Security Pack fixture validation", () => {
  it("requires positive, clean negative, and suppressed near-miss cases for every rule", async () => {
    const root = await createTask5Pack();
    const report = await validateSecurityPackFixtures(await loadSecurityPackManifest(root));

    expect(report).toEqual({
      schemaVersion: 1,
      packId: "org.scopeforge.fixtures",
      packVersion: "1.0.0",
      rules: 1,
      cases: 3,
      findings: 1,
      valid: true,
    });
    expect(Object.isFrozen(report)).toBe(true);
  });

  it.each([
    ["missing-positive", DEFAULT_TASK5_CASES.filter((item) => item.caseId !== "positive")],
    ["missing-negative", DEFAULT_TASK5_CASES.filter((item) => item.caseId !== "negative-safe")],
    ["missing-near-miss", DEFAULT_TASK5_CASES.filter((item) => item.caseId !== "negative-suppressed")],
    [
      "unexpected-location",
      DEFAULT_TASK5_CASES.map((item) => item.caseId === "positive"
        ? { ...item, expected: [{ file: "Dockerfile", startLine: 2, startColumn: 1 }] }
        : item),
    ],
    [
      "unexpected-count",
      DEFAULT_TASK5_CASES.map((item) => item.caseId === "positive"
        ? { ...item, expected: [] }
        : item),
    ],
  ] as const)("rejects fixture contract %s", async (_variant, cases) => {
    const root = await createTask5Pack(cases);
    await expect(validateSecurityPackFixtures(await loadSecurityPackManifest(root)))
      .rejects.toMatchObject({ code: "PACK_FIXTURE_MISMATCH" });
  });

  it("rejects a case bound to an unknown rule without reflecting hostile identity text", async () => {
    const root = await createTask5Pack([
      { ...caseById("positive"), ruleId: "unknown/hostile-rule" },
      caseById("negative-safe"),
      caseById("negative-suppressed"),
    ]);

    const rejection = await validateSecurityPackFixtures(await loadSecurityPackManifest(root))
      .catch((error: unknown) => error);
    expect(rejection).toMatchObject({ code: "PACK_FIXTURE_MISMATCH" });
    expect((rejection as Error).message).not.toContain("unknown/hostile-rule");
  });

  it("never rewrites manifests, case metadata, or fixture repository bytes", async () => {
    const root = await createTask5Pack();
    const before = await snapshotTask5Tree(root);

    await validateSecurityPackFixtures(await loadSecurityPackManifest(root));

    expect(await snapshotTask5Tree(root)).toEqual(before);
  });
});
