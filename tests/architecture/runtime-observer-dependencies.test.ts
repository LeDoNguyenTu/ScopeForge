import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

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

async function dependencyViolations(
  root: string,
  forbiddenReason: (specifier: string) => string | null,
): Promise<string[]> {
  const violations: string[] = [];

  for (const file of await listTypeScriptFiles(root)) {
    const source = await readFile(file, "utf8");
    for (const specifier of importSpecifiers(source)) {
      const reason = forbiddenReason(specifier);
      if (reason) {
        violations.push(`${path.relative(process.cwd(), file)} -> ${specifier} (${reason})`);
      }
    }
  }

  return violations;
}

function infrastructureReason(specifier: string): string | null {
  const normalized = specifier.toLowerCase();
  if (normalized === "next" || normalized.startsWith("next/")) return "Next.js";
  if (normalized === "react" || normalized.startsWith("react/")) return "React";
  if (normalized.startsWith("@supabase/")) return "Supabase";
  if (normalized.startsWith("@/lib/supabase")) return "Supabase application adapter";
  if (normalized.startsWith("@/app/") || normalized === "@/app") return "application layer";
  if (normalized.startsWith("@/components/") || normalized === "@/components") return "component layer";
  if (["openai", "anthropic", "gemini", "ollama"].some((name) => normalized.includes(name))) {
    return "model provider";
  }
  return null;
}

describe("passive runtime dependency direction", () => {
  it("keeps runtime-observer independent of the web, database, and model-provider layers", async () => {
    const root = path.resolve(process.cwd(), "packages/runtime-observer");
    expect(await dependencyViolations(root, infrastructureReason)).toEqual([]);
  });

  it("keeps network-safety pure and free of DNS, HTTP, TLS, database, and framework dependencies", async () => {
    const root = path.resolve(process.cwd(), "packages/network-safety");
    const networkSafetyReason = (specifier: string): string | null => {
      const normalized = specifier.toLowerCase();
      const infrastructure = infrastructureReason(specifier);
      if (infrastructure) return infrastructure;
      if (["dns", "node:dns", "http", "node:http", "https", "node:https", "tls", "node:tls"].includes(normalized)) {
        return "network I/O implementation";
      }
      if (normalized.includes("database") || normalized.includes("postgres")) return "database layer";
      return null;
    };

    expect(await dependencyViolations(root, networkSafetyReason)).toEqual([]);
  });
});
