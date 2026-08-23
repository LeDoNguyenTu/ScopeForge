import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runCli } from "@/packages/cli/run-cli";

const tempPaths: string[] = [];
const githubToken = "ghp_" + "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8";

async function tempDir() {
  const path = await mkdtemp(join(tmpdir(), "scopeforge-no-leak-"));
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
    serialized() { return JSON.stringify({ stdout, stderr }); },
    stdout() { return stdout; }
  };
}

afterEach(async () => {
  await Promise.all(tempPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("secret output non-leakage", () => {
  it("never emits a raw detected secret in terminal or JSON output", async () => {
    const root = await tempDir();
    await writeFile(join(root, "app.ts"), `export const token = "${githubToken}";\n`);

    const terminal = capture();
    expect(await runCli(["scan", root], { io: terminal.io })).toBe(0);
    expect(terminal.serialized()).not.toContain(githubToken);
    expect(terminal.stdout()).toContain("GitHub token exposed");

    const json = capture();
    expect(await runCli(["scan", root, "--format", "json"], { io: json.io })).toBe(0);
    expect(json.serialized()).not.toContain(githubToken);
    const parsed = JSON.parse(json.stdout());
    expect(parsed.findings[0].ruleId).toBe("secrets/github-token");
    expect(JSON.stringify(parsed.findings[0].evidence)).toContain("REDACTED");
  });
});
