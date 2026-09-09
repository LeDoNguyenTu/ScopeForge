import { afterEach, describe, expect, it } from "vitest";
import { join } from "node:path";

import {
  createTask4Pack,
  cleanupTask4Roots,
  task4Rule,
} from "./task4-helpers";
import { loadSecurityPackRegistry } from "@/packages/security-packs/registry";

afterEach(cleanupTask4Roots);

describe("Security Pack registry", () => {
  it("canonicalizes roots and orders packs and rules by published raw-text identity", async () => {
    const packB = await createTask4Pack("org.b", [task4Rule("beta/rule")]);
    const packA = await createTask4Pack("org.a", [
      task4Rule("zeta/rule"),
      task4Rule("alpha/rule"),
    ]);

    const registry = await loadSecurityPackRegistry([packB, packA], {
      currentScopeForgeVersion: "0.1.0",
    });

    expect(registry.packs.map((pack) => pack.manifest.packId)).toEqual(["org.a", "org.b"]);
    expect(registry.rules.map((entry) => entry.publishedRuleId)).toEqual([
      "pack/org.a/alpha/rule",
      "pack/org.a/zeta/rule",
      "pack/org.b/beta/rule",
    ]);
    expect(Object.isFrozen(registry)).toBe(true);
    expect(Object.isFrozen(registry.packs)).toBe(true);
    expect(Object.isFrozen(registry.rules)).toBe(true);
    expect(registry.rules[0]!.matchesPath("Dockerfile")).toBe(true);
    expect(registry.rules[0]!.matchesPath("src/index.ts")).toBe(false);
  });

  it("rejects duplicate canonical roots and duplicate or reserved published rule IDs", async () => {
    const packA = await createTask4Pack("org.a", [task4Rule("alpha/rule")]);
    const duplicateIdentity = await createTask4Pack("org.a", [task4Rule("alpha/rule")]);

    await expect(loadSecurityPackRegistry([packA, join(packA, ".")], {
      currentScopeForgeVersion: "0.1.0",
    })).rejects.toMatchObject({ code: "PACK_RULE_COLLISION" });

    await expect(loadSecurityPackRegistry([packA, duplicateIdentity], {
      currentScopeForgeVersion: "0.1.0",
    })).rejects.toMatchObject({ code: "PACK_RULE_COLLISION" });

    await expect(loadSecurityPackRegistry([packA], {
      currentScopeForgeVersion: "0.1.0",
      reservedRuleIds: ["pack/org.a/alpha/rule"],
    })).rejects.toMatchObject({ code: "PACK_RULE_COLLISION" });
  });

  it("enforces selected pack and selected rule ceilings before scanner execution", async () => {
    await expect(loadSecurityPackRegistry(
      Array.from({ length: 11 }, (_, index) => `/not-read/pack-${index}`),
      { currentScopeForgeVersion: "0.1.0" },
    )).rejects.toMatchObject({ code: "PACK_BUDGET_EXCEEDED" });

    const packs: string[] = [];
    for (let packIndex = 0; packIndex < 6; packIndex += 1) {
      const rules = Array.from({ length: 100 }, (_, ruleIndex) =>
        task4Rule(`rule-${packIndex}-${ruleIndex}`),
      );
      packs.push(await createTask4Pack(`org.limit${packIndex}`, rules));
    }

    await expect(loadSecurityPackRegistry(packs, {
      currentScopeForgeVersion: "0.1.0",
    })).rejects.toMatchObject({ code: "PACK_BUDGET_EXCEEDED" });
  });
});
