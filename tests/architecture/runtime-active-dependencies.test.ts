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
    } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
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
      if (reason) violations.push(`${path.relative(process.cwd(), file)} -> ${specifier} (${reason})`);
    }
  }

  return violations;
}

function applicationInfrastructureReason(specifier: string): string | null {
  const normalized = specifier.toLowerCase();
  if (normalized === "next" || normalized.startsWith("next/")) return "Next.js";
  if (normalized === "react" || normalized.startsWith("react/")) return "React";
  if (normalized.startsWith("@supabase/")) return "Supabase";
  if (normalized.startsWith("@/lib/")) return "application library";
  if (normalized.startsWith("@/app/") || normalized === "@/app") return "application layer";
  if (normalized.startsWith("@/components/") || normalized === "@/components") return "component layer";
  if (["openai", "anthropic", "gemini", "ollama"].some((name) => normalized.includes(name))) {
    return "model provider";
  }
  return null;
}

describe("active runtime dependency direction", () => {
  it("keeps runtime-network below observers and validators", async () => {
    const root = path.resolve(process.cwd(), "packages/runtime-network");
    const reason = (specifier: string): string | null => {
      const normalized = specifier.toLowerCase();
      const infrastructure = applicationInfrastructureReason(specifier);
      if (infrastructure) return infrastructure;
      if (normalized.includes("runtime-observer")) return "passive observer layer";
      if (normalized.includes("runtime-validator")) return "active validator layer";
      if (normalized.includes("security-domain")) return "finding domain layer";
      return null;
    };

    expect(await dependencyViolations(root, reason)).toEqual([]);
  });

  it("keeps runtime-validator independent of passive, web, database, and model-provider layers", async () => {
    const root = path.resolve(process.cwd(), "packages/runtime-validator");
    const reason = (specifier: string): string | null => {
      const normalized = specifier.toLowerCase();
      const infrastructure = applicationInfrastructureReason(specifier);
      if (infrastructure) return infrastructure;
      if (normalized.includes("runtime-observer")) return "passive runtime authority";
      return null;
    };

    expect(await dependencyViolations(root, reason)).toEqual([]);
  });

  it("keeps passive runtime-observer free of active-validation authority", async () => {
    const root = path.resolve(process.cwd(), "packages/runtime-observer");
    const violations = await dependencyViolations(root, (specifier) =>
      specifier.toLowerCase().includes("runtime-validator") ? "active validator layer" : null);

    expect(violations).toEqual([]);
  });

  it("prevents application code from importing shared runtime transport authority directly", async () => {
    const roots = ["app", "components", "lib"].map((directory) =>
      path.resolve(process.cwd(), directory));
    const violations: string[] = [];

    for (const root of roots) {
      violations.push(...await dependencyViolations(root, (specifier) =>
        specifier.toLowerCase().includes("runtime-network")
          ? "shared runtime transport authority"
          : null));
    }

    expect(violations).toEqual([]);
  });

  it("does not expose shared transport request-plan authority from the active validator package", async () => {
    const index = await readFile(
      path.resolve(process.cwd(), "packages/runtime-validator/index.ts"),
      "utf8",
    );

    expect(index).not.toContain("TrustedRuntimeRequestPlan");
    expect(index).not.toContain("TrustedRuntimeRequestHeaders");
    expect(index).not.toContain("requestPinnedHttps");
    expect(index).not.toContain("RuntimeTransportDependencies");
  });
});
