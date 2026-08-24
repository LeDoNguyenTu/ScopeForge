import { afterEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import type { ScannerRunResult } from "@/packages/scanner-core/coordinator/types";
import { buildRepositoryInventory } from "@/packages/scanner-core/inventory/build-inventory";
import { createIacScanner } from "@/packages/scanner-iac/scanner";

const tempPaths: string[] = [];

async function tempDir() {
  const path = await mkdtemp(join(tmpdir(), "scopeforge-actions-"));
  tempPaths.push(path);
  return path;
}

async function write(root: string, path: string, content: string) {
  const target = join(root, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content);
}

function structured(result: Awaited<ReturnType<ReturnType<typeof createIacScanner>["scan"]>>): ScannerRunResult {
  if (Array.isArray(result)) throw new Error("iac scanner should return structured results");
  return result;
}

afterEach(async () => {
  await Promise.all(tempPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("GitHub Actions IaC scanner integration", () => {
  it("scans workflow files alongside Terraform and Kubernetes", async () => {
    const root = await tempDir();
    await write(
      root,
      ".github/workflows/ci.yml",
      "name: CI\non: push\npermissions: write-all\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo ok\n"
    );
    await write(
      root,
      "main.tf",
      "resource \"aws_db_instance\" \"db\" {\n  publicly_accessible = true\n}\n"
    );
    await write(
      root,
      "pod.yaml",
      "apiVersion: v1\nkind: Pod\nmetadata:\n  name: api\nspec:\n  hostNetwork: true\n  containers:\n    - name: app\n      image: example.invalid/app:1\n"
    );

    const inventory = await buildRepositoryInventory(root);
    const result = structured(await createIacScanner().scan({ root, inventory }));

    expect(result.errors).toEqual([]);
    expect(result.findings.map((finding) => [finding.ruleId, finding.location.file])).toEqual(
      expect.arrayContaining([
        ["iac/github-actions-write-all-permissions", ".github/workflows/ci.yml"],
        ["iac/terraform-aws-public-rds", "main.tf"],
        ["iac/kubernetes-host-network", "pod.yaml"]
      ])
    );
    expect(result.findings).toHaveLength(3);
  });

  it("continues across malformed workflow YAML and reports incomplete coverage", async () => {
    const root = await tempDir();
    await write(root, ".github/workflows/broken.yml", "name: broken\njobs: [\n");
    await write(
      root,
      "main.tf",
      "resource \"aws_ebs_volume\" \"data\" {\n  encrypted = false\n}\n"
    );

    const inventory = await buildRepositoryInventory(root);
    const result = structured(await createIacScanner().scan({ root, inventory }));

    expect(result.findings.map((finding) => finding.ruleId)).toEqual([
      "iac/terraform-aws-unencrypted-storage"
    ]);
    expect(result.errors).toEqual([
      {
        code: "invalid_github_actions_yaml",
        file: ".github/workflows/broken.yml",
        message: "GitHub Actions YAML contains syntax errors and was not analyzed."
      }
    ]);
  });

  it("honors shared rule selection and keeps workflow fingerprints stable across line movement", async () => {
    const root = await tempDir();
    const workflowPath = ".github/workflows/ci.yml";
    const workflow = [
      "name: CI",
      "on: push",
      "permissions: write-all",
      "jobs:",
      "  build:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - run: echo ok"
    ].join("\n");
    await write(root, workflowPath, workflow);

    const firstInventory = await buildRepositoryInventory(root);
    const first = structured(await createIacScanner({
      rules: { include: ["iac/github-actions-write-all-permissions"], exclude: [] }
    }).scan({ root, inventory: firstInventory }));

    await write(root, workflowPath, `# harmless comment\n\n${workflow}\n`);
    const secondInventory = await buildRepositoryInventory(root);
    const second = structured(await createIacScanner({
      rules: { include: ["iac/github-actions-write-all-permissions"], exclude: [] }
    }).scan({ root, inventory: secondInventory }));

    expect(first.findings).toHaveLength(1);
    expect(second.findings).toHaveLength(1);
    expect(second.findings[0]?.fingerprint).toBe(first.findings[0]?.fingerprint);
    expect(second.findings[0]?.location.startLine).not.toBe(first.findings[0]?.location.startLine);
  });
});
