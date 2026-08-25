import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runCli } from "@/packages/cli/run-cli";
import { SCAN_EXIT } from "@/packages/scanner-core/policy/exit-codes";

const tempPaths: string[] = [];

function capture() {
  let stdout = "";
  let stderr = "";
  return {
    io: {
      stdout(value: string) { stdout += value; },
      stderr(value: string) { stderr += value; },
    },
    stdout: () => stdout,
    stderr: () => stderr,
  };
}

async function tempRepo() {
  const root = await mkdtemp(join(tmpdir(), "scopeforge-hosted-cli-"));
  tempPaths.push(root);
  await writeFile(join(root, "app.ts"), "export const safe = true;\n");
  return root;
}

afterEach(async () => {
  await Promise.all(tempPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("hosted-json CLI", () => {
  it("requires an explicit repository binding", async () => {
    const root = await tempRepo();
    const output = capture();

    expect(await runCli(["scan", root, "--format", "hosted-json"], { io: output.io })).toBe(
      SCAN_EXIT.USAGE_ERROR,
    );
    expect(output.stderr()).toContain("--repository");
  });

  it("emits the privacy-reduced hosted envelope when repository binding is supplied", async () => {
    const root = await tempRepo();
    const output = capture();

    expect(await runCli([
      "scan",
      root,
      "--format",
      "hosted-json",
      "--repository",
      "https://github.com/example/repo",
    ], { io: output.io })).toBe(SCAN_EXIT.SUCCESS);

    const parsed = JSON.parse(output.stdout());
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.repository.canonicalUrl).toBe("https://github.com/example/repo");
    expect(parsed.runRef).toMatch(/^sfh1:[a-f0-9]{64}$/);
    expect(JSON.stringify(parsed)).not.toContain(root);
  });
});
