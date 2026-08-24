import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { ScannerRunResult } from "@/packages/scanner-core/coordinator/types";
import { buildRepositoryInventory } from "@/packages/scanner-core/inventory/build-inventory";
import { createIacScanner } from "@/packages/scanner-iac/scanner";

const tempPaths: string[] = [];

async function tempDir() {
  const path = await mkdtemp(join(tmpdir(), "scopeforge-iac-"));
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

describe("createIacScanner", () => {
  it("scans only Docker infrastructure entries from the bounded repository inventory", async () => {
    const root = await tempDir();
    await writeFile(join(root, "Dockerfile"), "FROM ubuntu\nUSER node\n");
    await writeFile(join(root, "Dockerfile.release"), "FROM node:20\nRUN chmod 777 /app\n");
    await writeFile(join(root, "deployment.yaml"), "kind: Deployment\n");
    await writeFile(join(root, "notes.txt"), "FROM alpine:latest\n");

    const inventory = await buildRepositoryInventory(root);
    const result = structured(await createIacScanner().scan({ root, inventory }));

    expect(result.errors).toEqual([]);
    expect(result.findings.map((finding) => [finding.ruleId, finding.location.file])).toEqual([
      ["iac/docker-floating-base-image", "Dockerfile"],
      ["iac/docker-world-writable-permissions", "Dockerfile.release"]
    ]);
  });

  it("continues across invalid Docker input and reports incomplete coverage explicitly", async () => {
    const root = await tempDir();
    await writeFile(join(root, "Dockerfile"), "FROM node:20\nADD https://example.invalid/tool /tool\n");
    await writeFile(join(root, "Dockerfile.binary"), "FROM node:20\0USER root\n");

    const inventory = await buildRepositoryInventory(root);
    const result = structured(await createIacScanner().scan({ root, inventory }));

    expect(result.findings.map((finding) => finding.ruleId)).toEqual(["iac/docker-remote-add"]);
    expect(result.errors).toEqual([
      {
        code: "unsupported_binary_dockerfile",
        file: "Dockerfile.binary",
        message: "Dockerfile contains NUL bytes and was not parsed."
      }
    ]);
  });

  it("honors shared rule selection", async () => {
    const root = await tempDir();
    await writeFile(
      join(root, "Dockerfile"),
      "FROM ubuntu\nADD https://example.invalid/tool /tool\nRUN chmod 777 /app\n"
    );
    const inventory = await buildRepositoryInventory(root);

    const result = structured(await createIacScanner({
      rules: { include: ["iac/docker-remote-add"], exclude: [] }
    }).scan({ root, inventory }));

    expect(result.errors).toEqual([]);
    expect(result.findings.map((finding) => finding.ruleId)).toEqual(["iac/docker-remote-add"]);
  });

  it("keeps Docker finding fingerprints stable when unrelated lines move", async () => {
    const root = await tempDir();
    const dockerfile = join(root, "Dockerfile");
    await writeFile(dockerfile, "FROM node:20\nRUN chmod 777 /app\n");

    const firstInventory = await buildRepositoryInventory(root);
    const first = structured(await createIacScanner().scan({ root, inventory: firstInventory }));

    await writeFile(dockerfile, "# harmless comment\n\nFROM node:20\nRUN chmod 777 /app\n");
    const secondInventory = await buildRepositoryInventory(root);
    const second = structured(await createIacScanner().scan({ root, inventory: secondInventory }));

    expect(first.findings).toHaveLength(1);
    expect(second.findings).toHaveLength(1);
    expect(second.findings[0]?.fingerprint).toBe(first.findings[0]?.fingerprint);
    expect(second.findings[0]?.location.startLine).not.toBe(first.findings[0]?.location.startLine);
  });
});
