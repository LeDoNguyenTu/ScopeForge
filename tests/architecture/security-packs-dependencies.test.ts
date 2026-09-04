import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const packDirectory = resolve(root, "packages/security-packs");

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFiles(path));
    else if (/\.ts$/u.test(entry.name)) files.push(path);
  }
  return files.sort();
}

function importSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  for (const pattern of [
    /\bfrom\s+["']([^"']+)["']/gu,
    /\bimport\s+["']([^"']+)["']/gu,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/gu,
  ]) {
    for (const match of source.matchAll(pattern)) {
      if (match[1]) specifiers.push(match[1]);
    }
  }
  return specifiers;
}

function forbiddenSpecifier(specifier: string): boolean {
  return specifier === "next"
    || specifier.startsWith("next/")
    || specifier === "react"
    || specifier.startsWith("react/")
    || specifier.startsWith("@supabase/")
    || specifier.includes("runtime-network")
    || specifier.includes("runtime-worker")
    || specifier.includes("repository-acquisition")
    || specifier.includes("repository-snapshot")
    || specifier.includes("hosted-scanner")
    || specifier.includes("network-safety");
}

describe("Security Pack dependency boundary", () => {
  it("keeps the Security Pack package data-only and offline by import specifier", async () => {
    const forbiddenNodeModules = new Set([
      "node:child_process",
      "node:vm",
      "node:http",
      "node:https",
      "node:dns",
      "node:net",
      "node:tls",
      "node:dgram",
      "node:worker_threads",
    ]);

    for (const file of await sourceFiles(packDirectory)) {
      const source = await readFile(file, "utf8");
      const specifiers = importSpecifiers(source);
      for (const specifier of specifiers) {
        expect(forbiddenSpecifier(specifier), `${file}: ${specifier}`).toBe(false);
        expect(forbiddenNodeModules.has(specifier), `${file}: ${specifier}`).toBe(false);
      }
    }
  });

  it("contains no dynamic execution or network primitives", async () => {
    for (const file of await sourceFiles(packDirectory)) {
      const source = await readFile(file, "utf8");
      expect(source, file).not.toMatch(/\beval\s*\(/u);
      expect(source, file).not.toMatch(/\bFunction\s*\(/u);
      expect(source, file).not.toMatch(/\bimport\s*\(/u);
      expect(source, file).not.toMatch(/\bfetch\s*\(/u);
      expect(source, file).not.toMatch(/\bWebSocket\b/u);
    }
  });
});
