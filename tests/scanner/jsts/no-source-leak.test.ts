import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runCli } from "@/packages/cli/run-cli";

const tempPaths: string[] = [];
const sentinel = "UNRELATED_SOURCE_SENTINEL_7c91";

async function tempDir() {
  const path = await mkdtemp(join(tmpdir(), "scopeforge-jsts-output-"));
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
    serialized: () => JSON.stringify({ stdout, stderr })
  };
}

afterEach(async () => {
  await Promise.all(tempPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("JavaScript structural output boundary", () => {
  it("uses normalized structural evidence instead of unrelated repository source", async () => {
    const root = await tempDir();
    await writeFile(join(root, "runtime.ts"), `const note = "${sentinel}";\neval(userCode);\n`);

    const terminal = capture();
    expect(await runCli(["scan", root], { io: terminal.io })).toBe(0);
    expect(terminal.serialized()).not.toContain(sentinel);
    expect(terminal.stdout()).toContain("Dynamic code execution");

    const json = capture();
    expect(await runCli(["scan", root, "--format", "json"], { io: json.io })).toBe(0);
    expect(json.serialized()).not.toContain(sentinel);
    const parsed = JSON.parse(json.stdout());
    const finding = parsed.findings.find((candidate: { ruleId: string }) => candidate.ruleId === "jsts/dynamic-code-execution");
    expect(finding.evidence.redactedSnippet).toBe("eval(...)");
  });
});
