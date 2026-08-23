import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runCli } from "@/packages/cli/run-cli";

const tempPaths: string[] = [];

async function tempDir() {
  const path = await mkdtemp(join(tmpdir(), "scopeforge-jsts-taint-cli-"));
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

describe("Phase 3E CLI integration", () => {
  it("lists the command-injection rule and emits a source-safe JSON finding", async () => {
    const root = await tempDir();
    const sentinel = "TAINT_CLI_SOURCE_SENTINEL_d81c";
    await writeFile(join(root, "app.ts"), [
      "import express from 'express';",
      "import { exec } from 'node:child_process';",
      "const app = express();",
      `const note = '${sentinel}';`,
      "app.get('/run', (req, res) => exec(req.query.cmd));"
    ].join("\n"));

    const scan = capture();
    expect(await runCli(["scan", root, "--format", "json"], { io: scan.io })).toBe(0);
    const output = scan.stdout();
    const parsed = JSON.parse(output);
    expect(parsed.findings.map((finding: { ruleId: string }) => finding.ruleId)).toContain("jsts/command-injection");
    expect(output).not.toContain(sentinel);

    const rules = capture();
    expect(await runCli(["rules", "list"], { io: rules.io })).toBe(0);
    expect(rules.stdout()).toContain("jsts/command-injection\t1.0.0\tCommand injection");
  });

  it("applies existing fail-on policy to the high-severity taint finding", async () => {
    const root = await tempDir();
    await writeFile(join(root, "app.ts"), [
      "import express from 'express';",
      "import { execSync } from 'node:child_process';",
      "const app = express();",
      "app.post('/run', (req, res) => execSync(req.body.command));"
    ].join("\n"));

    const output = capture();
    expect(await runCli(["scan", root, "--fail-on", "high"], { io: output.io })).toBe(1);
    expect(output.stdout()).toContain("Command injection");
  });
});
