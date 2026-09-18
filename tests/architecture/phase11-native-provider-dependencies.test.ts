import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd(), "packages/provider-native-scopeforge");

async function files(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const found: string[] = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...await files(absolute));
    else if (entry.isFile() && entry.name.endsWith(".ts")) found.push(absolute);
  }
  return found;
}

describe("Phase 11 native provider authority boundary", () => {
  it("keeps native adapters as pure transformations over existing result contracts", async () => {
    for (const file of await files(root)) {
      const source = await readFile(file, "utf8");
      const relative = path.relative(process.cwd(), file);

      expect(source, relative).not.toMatch(/\bfetch\s*\(|\beval\s*\(|new\s+Function\s*\(/);
      expect(source, relative).not.toMatch(/node:(?:child_process|vm|http|https|dns|net|tls|dgram|worker_threads|fs)/);
      expect(source, relative).not.toMatch(/@supabase\/|@\/app\/|@\/components\/|@\/lib\//);
      expect(source, relative).not.toMatch(/observeRuntimeTarget|validateCorsOriginPolicy|buildPassiveResponseObservations|buildCorsPolicyObservation/);

      for (const line of source.split("\n")) {
        if (
          line.includes("../runtime-observer")
          || line.includes("../runtime-validator")
          || line.includes("../scanner-output/")
        ) {
          expect(line.trim(), relative).toMatch(/^import type /);
        }
      }
    }
  });
});
