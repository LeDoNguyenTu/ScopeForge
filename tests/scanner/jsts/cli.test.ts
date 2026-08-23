import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runCli } from "@/packages/cli/run-cli";

const tempPaths: string[] = [];

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
  it("registers jsts by default and lists its rules", async () => {
    const root = await tempDir();
    await writeFile(join(root, "runtime.ts"), "eval(userCode);\n");

    const scan = capture();
    expect(await runCli(["scan", root, "--format", "json"], { io: scan.io })).toBe(0);
    const parsed = JSON.parse(scan.stdout());
    expect(parsed.findings.some((finding: { ruleId: string }) => finding.ruleId === "jsts/dynamic-code-execution")).toBe(true);

    const rules = capture();
    expect(await runCli(["rules", "list"], { io: rules.io })).toBe(0);
    expect(rules.stdout()).toContain("jsts/dynamic-code-execution");
    expect(rules.stdout()).toContain("jsts/unsafe-child-process");
    expect(rules.stdout()).toContain("jsts/tls-verification-disabled");
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
