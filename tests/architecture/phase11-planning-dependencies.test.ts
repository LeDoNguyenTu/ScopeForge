import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const roots = [
  path.resolve(process.cwd(), "packages/security-planning"),
  path.resolve(process.cwd(), "packages/pentest-policy"),
  path.resolve(process.cwd(), "packages/capability-registry"),
  path.resolve(process.cwd(), "packages/pentest-planner"),
];

async function listTypeScriptFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listTypeScriptFiles(absolute));
    else if (entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) files.push(absolute);
  }
  return files;
}

function importSpecifiers(source: string): string[] {
  const values = new Set<string>();
  for (const pattern of [
    /\bfrom\s+["']([^"']+)["']/g,
    /\bimport\s+["']([^"']+)["']/g,
    /\bimport\(\s*["']([^"']+)["']\s*\)/g,
  ]) {
    for (const match of source.matchAll(pattern)) if (match[1]) values.add(match[1]);
  }
  return [...values];
}

function forbiddenReason(specifier: string): string | null {
  const normalized = specifier.toLowerCase();
  if (normalized === "next" || normalized.startsWith("next/")) return "Next.js";
  if (normalized === "react" || normalized.startsWith("react/")) return "React";
  if (normalized.startsWith("@supabase/") || normalized.includes("lib/supabase")) return "Supabase";
  if (normalized.includes("worker-") || normalized.includes("/workers/")) return "worker authority";
  if (normalized.includes("runtime-network") || normalized.includes("runtime-observer") || normalized.includes("runtime-validator")) return "runtime authority";
  if (normalized.includes("repository-acquisition") || normalized.includes("repository-snapshot")) return "repository acquisition authority";
  if (normalized.includes("scanner-") || normalized.includes("provider-")) return "scanner/provider implementation";
  if (["node:child_process", "node:vm", "node:http", "node:https", "node:dns", "node:net", "node:tls", "node:dgram", "node:worker_threads", "node:fs"].includes(normalized)) return "I/O/process authority";
  if (["openai", "anthropic", "gemini", "ollama"].some((name) => normalized.includes(name))) return "model provider";
  if (normalized.startsWith("@/app/") || normalized.startsWith("@/components/") || normalized.startsWith("@/lib/")) return "application layer";
  return null;
}

describe("Phase 11 planning dependency direction", () => {
  it("keeps planning and policy packages pure and authority-free", async () => {
    const violations: string[] = [];

    for (const root of roots) {
      for (const file of await listTypeScriptFiles(root)) {
        const source = await readFile(file, "utf8");
        for (const specifier of importSpecifiers(source)) {
          const reason = forbiddenReason(specifier);
          if (reason) violations.push(`${path.relative(process.cwd(), file)} -> ${specifier} (${reason})`);
        }
        expect(source, path.relative(process.cwd(), file)).not.toMatch(/\bfetch\s*\(|\beval\s*\(|new\s+Function\s*\(/);
      }
    }

    expect(violations).toEqual([]);
  });
});
