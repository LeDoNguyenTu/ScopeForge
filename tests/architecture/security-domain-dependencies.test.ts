import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const domainRoot = path.resolve(process.cwd(), "packages/security-domain");

async function listTypeScriptFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listTypeScriptFiles(absolutePath)));
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      files.push(absolutePath);
    }
  }

  return files;
}

function importSpecifiers(source: string): string[] {
  const specifiers = new Set<string>();
  const patterns = [
    /\bfrom\s+["']([^"']+)["']/g,
    /\bimport\s+["']([^"']+)["']/g,
    /\bimport\(\s*["']([^"']+)["']\s*\)/g,
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      if (match[1]) specifiers.add(match[1]);
    }
  }

  return [...specifiers];
}

function forbiddenReason(specifier: string): string | null {
  const normalized = specifier.toLowerCase();

  if (normalized.includes("scanner-")) return "scanner package";
  if (normalized.includes("/cli/")) return "CLI implementation";
  if (normalized === "next" || normalized.startsWith("next/")) return "Next.js";
  if (normalized === "react" || normalized.startsWith("react/")) return "React";
  if (normalized.startsWith("@supabase/")) return "Supabase";
  if (["openai", "anthropic", "gemini", "ollama"].some((name) => normalized.includes(name))) {
    return "model provider";
  }
  if (normalized.startsWith("@/app/") || normalized === "@/app") return "application layer";
  if (normalized.startsWith("@/components/") || normalized === "@/components") {
    return "component layer";
  }
  if (normalized.startsWith("@/lib/supabase")) return "Supabase application adapter";

  return null;
}

describe("security-domain dependency direction", () => {
  it("keeps the product security domain independent of scanners and infrastructure", async () => {
    const violations: string[] = [];

    for (const file of await listTypeScriptFiles(domainRoot)) {
      const source = await readFile(file, "utf8");
      for (const specifier of importSpecifiers(source)) {
        const reason = forbiddenReason(specifier);
        if (reason) {
          violations.push(`${path.relative(process.cwd(), file)} -> ${specifier} (${reason})`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
