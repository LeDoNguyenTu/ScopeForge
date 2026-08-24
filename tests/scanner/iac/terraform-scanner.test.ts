import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { ScannerRunResult } from "@/packages/scanner-core/coordinator/types";
import { buildRepositoryInventory } from "@/packages/scanner-core/inventory/build-inventory";
import { createIacScanner } from "@/packages/scanner-iac/scanner";

const tempPaths: string[] = [];

async function tempDir() {
  const path = await mkdtemp(join(tmpdir(), "scopeforge-terraform-"));
  tempPaths.push(path);
  return path;
}

function structured(result: Awaited<ReturnType<ReturnType<typeof createIacScanner>["scan"]>>): ScannerRunResult {
  if (Array.isArray(result)) throw new Error("iac scanner should return structured results");
  return result;
}

afterEach(async () => {
  await Promise.all(tempPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("Terraform IaC scanner integration", () => {
  it("scans Terraform infrastructure entries alongside Docker and Kubernetes", async () => {
    const root = await tempDir();
    await writeFile(join(root, "Dockerfile"), "FROM node:20\n");
    await writeFile(
      join(root, "pod.yaml"),
      "apiVersion: v1\nkind: Pod\nmetadata:\n  name: api\nspec:\n  hostNetwork: true\n  containers:\n    - name: app\n      image: example.invalid/app:1\n"
    );
    await writeFile(
      join(root, "main.tf"),
      "resource \"aws_db_instance\" \"db\" {\n  publicly_accessible = true\n}\n"
    );
    await writeFile(join(root, "notes.txt"), "resource \"aws_db_instance\" \"fake\" {}\n");

    const inventory = await buildRepositoryInventory(root);
    const result = structured(await createIacScanner().scan({ root, inventory }));

    expect(result.errors).toEqual([]);
    expect(result.findings.map((finding) => [finding.ruleId, finding.location.file])).toEqual([
      ["iac/terraform-aws-public-rds", "main.tf"],
      ["iac/kubernetes-host-network", "pod.yaml"]
    ]);
  });

  it("continues across malformed Terraform and reports incomplete coverage explicitly", async () => {
    const root = await tempDir();
    await writeFile(join(root, "broken.tf"), "resource \"aws_db_instance\" \"broken\" {\n");
    await writeFile(
      join(root, "safe.tf"),
      "resource \"aws_ebs_volume\" \"data\" {\n  encrypted = false\n}\n"
    );

    const inventory = await buildRepositoryInventory(root);
    const result = structured(await createIacScanner().scan({ root, inventory }));

    expect(result.findings.map((finding) => finding.ruleId)).toEqual([
      "iac/terraform-aws-unencrypted-storage"
    ]);
    expect(result.errors).toEqual([
      {
        code: "invalid_terraform_hcl",
        file: "broken.tf",
        message: "Terraform HCL contains syntax errors and was not analyzed."
      }
    ]);
  });

  it("honors shared rule selection for Terraform rules", async () => {
    const root = await tempDir();
    await writeFile(
      join(root, "main.tf"),
      [
        "resource \"aws_db_instance\" \"db\" {",
        "  publicly_accessible = true",
        "  storage_encrypted   = false",
        "}"
      ].join("\n")
    );
    const inventory = await buildRepositoryInventory(root);

    const result = structured(await createIacScanner({
      rules: { include: ["iac/terraform-aws-public-rds"], exclude: [] }
    }).scan({ root, inventory }));

    expect(result.errors).toEqual([]);
    expect(result.findings.map((finding) => finding.ruleId)).toEqual([
      "iac/terraform-aws-public-rds"
    ]);
  });

  it("keeps Terraform fingerprints stable when unrelated lines move", async () => {
    const root = await tempDir();
    const terraform = join(root, "main.tf");
    await writeFile(
      terraform,
      "resource \"aws_db_instance\" \"db\" {\n  publicly_accessible = true\n}\n"
    );

    const firstInventory = await buildRepositoryInventory(root);
    const first = structured(await createIacScanner().scan({ root, inventory: firstInventory }));

    await writeFile(
      terraform,
      "# harmless comment\n\nresource \"aws_db_instance\" \"db\" {\n  publicly_accessible = true\n}\n"
    );
    const secondInventory = await buildRepositoryInventory(root);
    const second = structured(await createIacScanner().scan({ root, inventory: secondInventory }));

    expect(first.findings).toHaveLength(1);
    expect(second.findings).toHaveLength(1);
    expect(second.findings[0]?.fingerprint).toBe(first.findings[0]?.fingerprint);
    expect(second.findings[0]?.location.startLine).not.toBe(first.findings[0]?.location.startLine);
  });
});
