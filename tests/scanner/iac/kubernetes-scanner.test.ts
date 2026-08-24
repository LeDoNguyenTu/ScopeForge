import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { ScannerRunResult } from "@/packages/scanner-core/coordinator/types";
import { buildRepositoryInventory } from "@/packages/scanner-core/inventory/build-inventory";
import { createIacScanner } from "@/packages/scanner-iac/scanner";

const tempPaths: string[] = [];

async function tempDir() {
  const path = await mkdtemp(join(tmpdir(), "scopeforge-kubernetes-"));
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

describe("Kubernetes IaC scanner integration", () => {
  it("scans Kubernetes YAML infrastructure entries alongside Dockerfiles", async () => {
    const root = await tempDir();
    await writeFile(join(root, "Dockerfile"), "FROM node:20\n");
    await writeFile(
      join(root, "deployment.yaml"),
      "apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: api\nspec:\n  template:\n    spec:\n      hostNetwork: true\n      containers:\n        - name: app\n          image: example.invalid/app:1\n"
    );
    await writeFile(join(root, "generic.yml"), "service:\n  enabled: true\n");
    await writeFile(join(root, "notes.txt"), "kind: Pod\nspec:\n  hostNetwork: true\n");

    const inventory = await buildRepositoryInventory(root);
    const result = structured(await createIacScanner().scan({ root, inventory }));

    expect(result.errors).toEqual([]);
    expect(result.findings.map((finding) => [finding.ruleId, finding.location.file])).toEqual([
      ["iac/kubernetes-host-network", "deployment.yaml"]
    ]);
  });

  it("continues across malformed Kubernetes YAML and reports incomplete coverage explicitly", async () => {
    const root = await tempDir();
    await writeFile(join(root, "broken.yaml"), "apiVersion: v1\nkind: Pod\nmetadata: [broken\n");
    await writeFile(
      join(root, "safe.yaml"),
      "apiVersion: v1\nkind: Pod\nmetadata:\n  name: api\nspec:\n  hostPID: true\n  containers:\n    - name: app\n      image: example.invalid/app:1\n"
    );

    const inventory = await buildRepositoryInventory(root);
    const result = structured(await createIacScanner().scan({ root, inventory }));

    expect(result.findings.map((finding) => finding.ruleId)).toEqual(["iac/kubernetes-host-pid"]);
    expect(result.errors).toEqual([
      {
        code: "invalid_kubernetes_yaml",
        file: "broken.yaml",
        message: "Kubernetes YAML contains syntax errors and was not analyzed."
      }
    ]);
  });

  it("honors shared rule selection for Kubernetes rules", async () => {
    const root = await tempDir();
    await writeFile(
      join(root, "pod.yaml"),
      "apiVersion: v1\nkind: Pod\nmetadata:\n  name: api\nspec:\n  hostNetwork: true\n  hostPID: true\n  containers:\n    - name: app\n      image: example.invalid/app:1\n"
    );
    const inventory = await buildRepositoryInventory(root);

    const result = structured(await createIacScanner({
      rules: { include: ["iac/kubernetes-host-pid"], exclude: [] }
    }).scan({ root, inventory }));

    expect(result.errors).toEqual([]);
    expect(result.findings.map((finding) => finding.ruleId)).toEqual(["iac/kubernetes-host-pid"]);
  });

  it("keeps Kubernetes finding fingerprints stable when unrelated lines move", async () => {
    const root = await tempDir();
    const manifest = join(root, "pod.yaml");
    await writeFile(
      manifest,
      "apiVersion: v1\nkind: Pod\nmetadata:\n  name: api\nspec:\n  hostNetwork: true\n  containers:\n    - name: app\n      image: example.invalid/app:1\n"
    );

    const firstInventory = await buildRepositoryInventory(root);
    const first = structured(await createIacScanner().scan({ root, inventory: firstInventory }));

    await writeFile(
      manifest,
      "# harmless comment\n\napiVersion: v1\nkind: Pod\nmetadata:\n  name: api\nspec:\n  hostNetwork: true\n  containers:\n    - name: app\n      image: example.invalid/app:1\n"
    );
    const secondInventory = await buildRepositoryInventory(root);
    const second = structured(await createIacScanner().scan({ root, inventory: secondInventory }));

    expect(first.findings).toHaveLength(1);
    expect(second.findings).toHaveLength(1);
    expect(second.findings[0]?.fingerprint).toBe(first.findings[0]?.fingerprint);
    expect(second.findings[0]?.location.startLine).not.toBe(first.findings[0]?.location.startLine);
  });
});
