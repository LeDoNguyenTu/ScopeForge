import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { loadBaseline } from "@/packages/scanner-core/baseline/load";

const tempPaths: string[] = [];

async function tempDir(prefix: string) {
  const path = await mkdtemp(join(tmpdir(), prefix));
  tempPaths.push(path);
  return path;
}

afterEach(async () => {
  await Promise.all(tempPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("baseline validation", () => {
  it("rejects duplicate fingerprints and invalid fingerprint formats", async () => {
    const root = await tempDir("scopeforge-baseline-duplicates-");
    const entry = {
      fingerprint: `sf1:${"a".repeat(64)}`,
      scanner: "test",
      ruleId: "test/high",
      ruleVersion: "1.0.0",
      severity: "high",
      file: "src/a.ts"
    };
    await writeFile(
      join(root, "duplicate.json"),
      JSON.stringify({ version: 1, tool: { name: "ScopeForge", version: "0.1.0" }, entries: [entry, entry] })
    );
    await expect(loadBaseline(root, "duplicate.json")).rejects.toMatchObject({ code: "invalid_baseline" });

    await writeFile(
      join(root, "invalid.json"),
      JSON.stringify({
        version: 1,
        tool: { name: "ScopeForge", version: "0.1.0" },
        entries: [{ ...entry, fingerprint: "not-a-scopeforge-fingerprint" }]
      })
    );
    await expect(loadBaseline(root, "invalid.json")).rejects.toMatchObject({ code: "invalid_baseline" });
  });
});
