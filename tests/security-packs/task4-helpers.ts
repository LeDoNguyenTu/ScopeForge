import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { SecurityPackRuleV1 } from "@/packages/security-packs/contracts";

const temporaryRoots: string[] = [];

export async function cleanupTask4Roots(): Promise<void> {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
}

export async function temporaryDirectory(prefix = "scopeforge-pack-task4-"): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), prefix));
  temporaryRoots.push(root);
  return root;
}

export function task4Rule(
  id: string,
  options: {
    include?: readonly string[];
    exclude?: readonly string[];
    literal?: string;
    severity?: SecurityPackRuleV1["severity"];
  } = {},
): SecurityPackRuleV1 {
  return {
    id,
    version: "1.0.0",
    kind: "static_literal_v1",
    title: `Rule ${id}`,
    summary: "Detects a fixed unsafe configuration literal.",
    description: "This deterministic fixture rule detects one fixed static literal.",
    severity: options.severity ?? "high",
    confidence: "high",
    category: "configuration",
    mappings: {
      cwe: ["CWE-295"],
      owasp: ["A02:2021"],
      attack: [],
      nistCsf: [],
    },
    explanations: {
      plain: "Plain explanation.",
      developer: "Developer explanation.",
      security: "Security explanation.",
    },
    remediation: {
      summary: "Restore the safe setting.",
      guidance: "Remove the unsafe literal.",
      verification: "Rescan and verify it is absent.",
    },
    preparedness: [],
    falsePositiveNotes: [],
    matcher: {
      include: options.include ?? ["**/Dockerfile*"],
      exclude: options.exclude ?? [],
      mode: "any",
      literals: [options.literal ?? "UNSAFE_SETTING=1"],
      absentLiterals: [],
      caseSensitive: true,
    },
  };
}

export async function createTask4Pack(
  packId: string,
  rules: readonly SecurityPackRuleV1[],
): Promise<string> {
  const root = await temporaryDirectory();
  await mkdir(root, { recursive: true });
  await writeFile(
    join(root, "scopeforge-pack.json"),
    JSON.stringify({
      schemaVersion: 1,
      packId,
      version: "1.0.0",
      name: `Pack ${packId}`,
      summary: "Deterministic Task 4 Security Pack fixture.",
      license: "MIT",
      repository: `https://github.com/scopeforge/${packId.replaceAll(".", "-")}`,
      maintainers: ["scopeforge"],
      safety: "static",
      minimumScopeForgeVersion: "0.1.0",
      rules,
    }),
  );
  return root;
}

export async function createTask4Repository(
  files: Readonly<Record<string, string | Uint8Array>>,
): Promise<string> {
  const root = await temporaryDirectory("scopeforge-pack-repo-");
  for (const [relativePath, contents] of Object.entries(files)) {
    const absolute = join(root, ...relativePath.split("/"));
    await mkdir(join(absolute, ".."), { recursive: true });
    await writeFile(absolute, contents);
  }
  return root;
}
