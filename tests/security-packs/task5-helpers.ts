import { createHash } from "node:crypto";
import {
  link,
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

const temporaryRoots: string[] = [];

export interface FixtureExpectedLocation {
  file: string;
  startLine: number;
  startColumn: number;
}

export interface FixtureCaseInput {
  caseId: string;
  ruleId?: string;
  classification: "positive" | "negative";
  expected: readonly FixtureExpectedLocation[];
  files: Readonly<Record<string, string | Uint8Array>>;
  rationale?: string;
}

export async function cleanupTask5Roots(): Promise<void> {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
}

export async function task5TemporaryRoot(prefix = "scopeforge-pack-task5-"): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), prefix));
  temporaryRoots.push(root);
  return root;
}

function validRule() {
  return {
    id: "config/unsafe-setting",
    version: "1.0.0",
    kind: "static_literal_v1",
    title: "Unsafe setting",
    summary: "Detects one unsafe fixed setting.",
    description: "A deterministic fixture rule for Security Pack validation.",
    severity: "high",
    confidence: "high",
    category: "configuration",
    mappings: {
      cwe: ["CWE-295"],
      owasp: ["A02:2021"],
      attack: [],
      nistCsf: [],
    },
    explanations: {
      plain: "The unsafe setting is enabled.",
      developer: "Remove the unsafe setting.",
      security: "The unsafe setting weakens a reviewed security boundary.",
    },
    remediation: {
      summary: "Restore the safe setting.",
      guidance: "Remove the unsafe literal and use the safe default.",
      verification: "Rescan and confirm the rule no longer matches.",
    },
    preparedness: [],
    falsePositiveNotes: ["Reviewed test-only cases may carry the suppression marker."],
    matcher: {
      include: ["**/Dockerfile*"],
      exclude: ["**/test-fixtures/**"],
      mode: "any",
      literals: ["UNSAFE_SETTING=1"],
      absentLiterals: ["scopeforge-reviewed-test-only"],
      caseSensitive: true,
    },
  };
}

function manifest() {
  return {
    schemaVersion: 1,
    packId: "org.scopeforge.fixtures",
    version: "1.0.0",
    name: "ScopeForge Fixture Pack",
    summary: "Fixture validator test pack.",
    license: "MIT",
    repository: "https://github.com/scopeforge/fixture-pack",
    maintainers: ["scopeforge"],
    safety: "static",
    minimumScopeForgeVersion: "0.1.0",
    rules: [validRule()],
  };
}

export const DEFAULT_TASK5_CASES: readonly FixtureCaseInput[] = Object.freeze([
  {
    caseId: "positive",
    classification: "positive",
    expected: [{ file: "Dockerfile", startLine: 1, startColumn: 1 }],
    files: { Dockerfile: "UNSAFE_SETTING=1\n" },
  },
  {
    caseId: "negative-safe",
    classification: "negative",
    expected: [],
    files: { Dockerfile: "SAFE_SETTING=1\n" },
  },
  {
    caseId: "negative-suppressed",
    classification: "negative",
    expected: [],
    files: {
      Dockerfile: "UNSAFE_SETTING=1\nscopeforge-reviewed-test-only\n",
    },
  },
]);

export async function writeTask5Case(
  packRoot: string,
  input: FixtureCaseInput,
): Promise<string> {
  const caseRoot = join(packRoot, "fixtures", input.caseId);
  const repositoryRoot = join(caseRoot, "repository");
  await mkdir(repositoryRoot, { recursive: true });
  await writeFile(
    join(caseRoot, "case.json"),
    JSON.stringify({
      schemaVersion: 1,
      caseId: input.caseId,
      ruleId: input.ruleId ?? "config/unsafe-setting",
      classification: input.classification,
      expected: input.expected,
      rationale: input.rationale ?? `Fixture case ${input.caseId}.`,
    }),
  );
  for (const [repositoryPath, contents] of Object.entries(input.files)) {
    const absolute = join(repositoryRoot, ...repositoryPath.split("/"));
    await mkdir(join(absolute, ".."), { recursive: true });
    await writeFile(absolute, contents);
  }
  return caseRoot;
}

export async function createTask5Pack(
  cases: readonly FixtureCaseInput[] = DEFAULT_TASK5_CASES,
): Promise<string> {
  const root = await task5TemporaryRoot();
  await mkdir(join(root, "fixtures"), { recursive: true });
  await writeFile(join(root, "scopeforge-pack.json"), JSON.stringify(manifest()));
  for (const fixtureCase of cases) await writeTask5Case(root, fixtureCase);
  return root;
}

export async function createOutsideFile(contents = "OUTSIDE_SENTINEL\n"): Promise<string> {
  const root = await task5TemporaryRoot("scopeforge-pack-outside-");
  const path = join(root, "outside.txt");
  await writeFile(path, contents);
  return path;
}

export async function replaceWithSymlink(path: string, target: string): Promise<void> {
  await rm(path, { force: true });
  await symlink(target, path);
}

export async function replaceWithHardLink(path: string, target: string): Promise<void> {
  await rm(path, { force: true });
  await link(target, path);
}

async function collectRegularFiles(root: string, directory = root): Promise<string[]> {
  const output: string[] = [];
  for (const entry of (await readdir(directory, { withFileTypes: true }))
    .sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0)) {
    const absolute = join(directory, entry.name);
    const stat = await lstat(absolute);
    if (stat.isDirectory() && !stat.isSymbolicLink()) {
      output.push(...await collectRegularFiles(root, absolute));
    } else if (stat.isFile() && !stat.isSymbolicLink()) {
      output.push(relative(root, absolute).replaceAll("\\", "/"));
    }
  }
  return output;
}

export async function snapshotTask5Tree(root: string): Promise<Readonly<Record<string, string>>> {
  const result: Record<string, string> = {};
  for (const repositoryPath of await collectRegularFiles(root)) {
    const bytes = await readFile(join(root, ...repositoryPath.split("/")));
    result[repositoryPath] = createHash("sha256").update(bytes).digest("hex");
  }
  return Object.freeze(result);
}
