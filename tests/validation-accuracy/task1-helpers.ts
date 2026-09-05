import { link, mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export interface CasePatch {
  schemaVersion?: number;
  caseId?: string;
  scanner?: string;
  ruleId?: string;
  label?: string;
  repository?: string;
  rationale?: string;
  expectedFiles?: string[];
  expectedSeverity?: string;
  expectedConfidence?: string;
  expectedCwe?: string[];
  remediationOf?: string;
  notes?: string;
  extra?: unknown;
}

export function vulnerableCase(caseId = "case-a", patch: CasePatch = {}) {
  return {
    schemaVersion: 1,
    caseId,
    scanner: "jsts",
    ruleId: "jsts/dynamic-code-execution",
    label: "vulnerable",
    repository: "repository",
    rationale: "A deterministic vulnerable validation case.",
    expectedFiles: ["src/app.ts"],
    expectedSeverity: "medium",
    expectedConfidence: "high",
    ...patch,
  };
}

export function cleanCase(caseId = "case-clean", patch: CasePatch = {}) {
  return {
    schemaVersion: 1,
    caseId,
    scanner: "jsts",
    ruleId: "jsts/dynamic-code-execution",
    label: "clean",
    repository: "repository",
    rationale: "A deterministic clean validation case.",
    expectedFiles: [],
    ...patch,
  };
}

export async function validationRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), "scopeforge-validation-"));
}

export async function writeCorpus(
  cases: Array<{ directory: string; manifest: Record<string, unknown>; files?: Record<string, string | Buffer> }>,
  corpusPatch: Record<string, unknown> = {},
): Promise<string> {
  const root = await validationRoot();
  const caseDirectories = cases.map((item) => item.directory);
  await writeFile(
    join(root, "corpus.json"),
    JSON.stringify({
      schemaVersion: 1,
      corpusId: "scopeforge-offline-v1",
      corpusVersion: "1.0.0",
      cases: caseDirectories,
      ...corpusPatch,
    }),
  );

  for (const item of cases) {
    const caseDirectory = join(root, item.directory);
    await mkdir(join(caseDirectory, "repository"), { recursive: true });
    await writeFile(join(caseDirectory, "case.json"), JSON.stringify(item.manifest));
    for (const [path, content] of Object.entries(item.files ?? { "src/app.ts": "eval(input);\n" })) {
      const absolute = join(caseDirectory, "repository", path);
      await mkdir(dirname(absolute), { recursive: true });
      await writeFile(absolute, content);
    }
  }
  return root;
}

export async function addRepositorySymlink(root: string, casePath: string): Promise<void> {
  const repository = join(root, casePath, "repository");
  await symlink(join(repository, "src", "app.ts"), join(repository, "link.ts"));
}

export async function addRepositoryHardLink(root: string, casePath: string): Promise<void> {
  const repository = join(root, casePath, "repository");
  await link(join(repository, "src", "app.ts"), join(repository, "copy.ts"));
}
