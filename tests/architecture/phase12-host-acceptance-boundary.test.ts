import { readFile, readdir } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("Phase 12 acceptance-only dependency boundary", () => {
  it("cannot register workers, enqueue work, mutate the database or import production credentials", async () => {
    const root = "packages/provider-host-acceptance";
    const files = (await readdir(root)).filter((file) => file.endsWith(".ts"));
    for (const file of files) {
      const source = await readFile(`${root}/${file}`, "utf8");
      const imports = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]);
      for (const dependency of imports) {
        expect(dependency, `${file}: ${dependency}`).toMatch(
          /^(?:node:[a-z/_]+|\.\/(?:authorization|transport-probes|sandbox-probes|namespace-probe)|\.\.\/provider-(?:egress-boundary|runtime-sandbox))$/,
        );
      }
      const environments = [...source.matchAll(/process\.env\.([A-Z_]+)/g)].map((match) => match[1]);
      expect(environments.every((name) => ["HOME", "XDG_RUNTIME_DIR"].includes(name))).toBe(true);
      expect(source).not.toMatch(/\b(?:fetch|eval)\s*\(|\bimport\s*\(|shell:\s*true/);
    }
  });
});
