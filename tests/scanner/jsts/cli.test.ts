import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runCli } from "@/packages/cli/run-cli";

const tempPaths: string[] = [];
const githubToken = "ghp_" + "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8";

async function tempDir() {
  const path = await mkdtemp(join(tmpdir(), "scopeforge-jsts-cli-"));
  tempPaths.push(path);
  return path;
}

function capture() {
  let stdout = "";
  let stderr = "";
  return {
    io: {
      stdout(value: string) { stdout += value; },
      stderr(value: string) { stderr += value; }
    },
    stdout: () => stdout,
    stderr: () => stderr
  };
}

afterEach(async () => {
  await Promise.all(tempPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("JavaScript scanner CLI integration", () => {
  it("runs secrets and jsts by default and lists all built-in rules deterministically", async () => {
    const root = await tempDir();
    await writeFile(join(root, "runtime.ts"), `const token = "${githubToken}";\neval(userCode);\n`);

    const scan = capture();
    expect(await runCli(["scan", root, "--format", "json"], { io: scan.io })).toBe(0);
    const parsed = JSON.parse(scan.stdout());
    const ruleIds = parsed.findings.map((finding: { ruleId: string }) => finding.ruleId);
    expect(ruleIds).toContain("secrets/github-token");
    expect(ruleIds).toContain("jsts/dynamic-code-execution");

    const rules = capture();
    expect(await runCli(["rules", "list"], { io: rules.io })).toBe(0);
    const listedIds = rules.stdout().trim().split("\n").map((line) => line.split("\t")[0]);
    expect(listedIds).toEqual([...listedIds].sort());
    expect(listedIds).toEqual(expect.arrayContaining([
      "jsts/dynamic-code-execution",
      "jsts/insecure-cookie",
      "jsts/tls-verification-disabled",
      "secrets/github-token",
      "secrets/high-entropy-assignment"
    ]));
  });

  it("honors configured scanner-family selection", async () => {
    const root = await tempDir();
    await writeFile(join(root, "runtime.ts"), `const token = "${githubToken}";\neval(userCode);\n`);
    await writeFile(join(root, ".scopeforge.json"), JSON.stringify({ version: 1, scanners: ["jsts"] }));

    const output = capture();
    expect(await runCli(["scan", root, "--format", "json"], { io: output.io })).toBe(0);
    const ruleIds = JSON.parse(output.stdout()).findings.map((finding: { ruleId: string }) => finding.ruleId);
    expect(ruleIds).toContain("jsts/dynamic-code-execution");
    expect(ruleIds).not.toContain("secrets/github-token");
  });

  it("fails closed for an unknown jsts rule", async () => {
    const root = await tempDir();
    await writeFile(join(root, ".scopeforge.json"), JSON.stringify({
      version: 1,
      rules: { include: ["jsts/not-a-rule"] }
    }));

    const output = capture();
    expect(await runCli(["scan", root], { io: output.io })).toBe(2);
    expect(output.stderr()).toContain("Unknown configured rule");
  });
});
