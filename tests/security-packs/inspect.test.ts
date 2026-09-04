import { afterEach, describe, expect, it } from "vitest";

import { inspectSecurityPack } from "@/packages/security-packs/inspect";
import { loadSecurityPackManifest } from "@/packages/security-packs/parse";
import {
  cleanupTask5Roots,
  createTask5Pack,
} from "./task5-helpers";

afterEach(cleanupTask5Roots);

describe("Security Pack inspection", () => {
  it("emits deterministic reviewed metadata without literal, fixture, or absolute-path leakage", async () => {
    const root = await createTask5Pack();
    const pack = await loadSecurityPackManifest(root);

    const first = inspectSecurityPack(pack);
    const second = inspectSecurityPack(pack);
    expect(first).toBe(second);

    const parsed = JSON.parse(first);
    expect(parsed).toMatchObject({
      schemaVersion: 1,
      pack: {
        id: "org.scopeforge.fixtures",
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
            kind: "static_literal_v1",
            requiredLiteralCount: 1,
            absentLiteralCount: 1,
          },
        }),
      ],
    });

    expect(first).not.toContain("UNSAFE_SETTING=1");
    expect(first).not.toContain("scopeforge-reviewed-test-only");
    expect(first).not.toContain(root);
    expect(first).not.toContain("fixtures/positive");
  });

  it("sorts reviewed mapping arrays deterministically without changing the loaded pack", async () => {
    const root = await createTask5Pack();
    const pack = await loadSecurityPackManifest(root);
    const before = JSON.stringify(pack.manifest);

    const inspected = JSON.parse(inspectSecurityPack(pack));

    expect(inspected.rules[0]?.mappings.cwe).toEqual(["CWE-295"]);
    expect(inspected.rules[0]?.mappings.owasp).toEqual(["A02:2021"]);
    expect(inspected.rules[0]?.mappings.attack).toEqual([]);
    expect(inspected.rules[0]?.mappings.nistCsf).toEqual([]);
    expect(JSON.stringify(pack.manifest)).toBe(before);
  });
});
