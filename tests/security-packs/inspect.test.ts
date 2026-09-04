import { afterEach, describe, expect, it } from "vitest";

import { inspectSecurityPack } from "@/packages/security-packs/inspect";
import { loadSecurityPackManifest } from "@/packages/security-packs/parse";
import {
  cleanupTask5Roots,
  createTask5Pack,
} from "./task5-helpers";

afterEach(cleanupTask5Roots);

describe("Security Pack inspection", () => {
  it("returns deterministic reviewed metadata without literal, fixture, or absolute-path leakage", async () => {
    const root = await createTask5Pack();
    const pack = await loadSecurityPackManifest(root);

    const first = inspectSecurityPack(pack);
    const second = inspectSecurityPack(pack);

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      schemaVersion: 1,
      pack: {
        packId: "org.scopeforge.fixtures",
        version: "1.0.0",
        name: "ScopeForge Fixture Pack",
        license: "MIT",
        safety: "static",
        minimumScopeForgeVersion: "0.1.0",
      },
      rules: [
        expect.objectContaining({
          id: "config/unsafe-setting",
          publishedRuleId: "pack/org.scopeforge.fixtures/config/unsafe-setting",
          version: "1.0.0",
          matcher: {
            include: ["**/Dockerfile*"],
            exclude: ["**/test-fixtures/**"],
            mode: "any",
            literalCount: 1,
            absentLiteralCount: 1,
            caseSensitive: true,
          },
        }),
      ],
    });
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.rules)).toBe(true);

    const serialized = JSON.stringify(first);
    expect(serialized).not.toContain("UNSAFE_SETTING=1");
    expect(serialized).not.toContain("scopeforge-reviewed-test-only");
    expect(serialized).not.toContain(root);
    expect(serialized).not.toContain("fixtures/positive");
    expect(serialized).not.toContain("Dockerfile\"");
  });

  it("sorts reviewed mapping and guidance arrays deterministically without changing the loaded pack", async () => {
    const root = await createTask5Pack();
    const pack = await loadSecurityPackManifest(root);
    const before = JSON.stringify(pack.manifest);

    const inspected = inspectSecurityPack(pack);

    expect(inspected.rules[0]?.mappings.cwe).toEqual(["CWE-295"]);
    expect(inspected.rules[0]?.mappings.owasp).toEqual(["A02:2021"]);
    expect(inspected.rules[0]?.preparedness).toEqual([]);
    expect(inspected.rules[0]?.falsePositiveNotes).toEqual([
      "Reviewed test-only cases may carry the suppression marker.",
    ]);
    expect(JSON.stringify(pack.manifest)).toBe(before);
  });
});
