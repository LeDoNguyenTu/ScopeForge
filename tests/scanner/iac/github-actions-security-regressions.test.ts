import { afterEach, describe, expect, it, vi } from "vitest";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { formatBuiltInRuleList } from "@/packages/cli/builtins";
import { runCli } from "@/packages/cli/run-cli";

const tempPaths: string[] = [];

async function tempDir() {
  const path = await mkdtemp(join(tmpdir(), "scopeforge-actions-security-"));
  tempPaths.push(path);
  await mkdir(join(path, ".github", "workflows"), { recursive: true });
  return path;
}

function captureIo() {
  let stdout = "";
  let stderr = "";
  return {
    io: {
      stdout(value: string) { stdout += value; },
      stderr(value: string) { stderr += value; }
    },
    serialized: () => JSON.stringify({ stdout, stderr })
  };
}

afterEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all(tempPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("GitHub Actions IaC security regressions", () => {
  it("never executes workflow run steps, actions, or network requests", async () => {
    const root = await tempDir();
    const marker = join(root, "workflow-executed.txt");
    await writeFile(
      join(root, ".github", "workflows", "ci.yml"),
      [
        "name: Hostile workflow",
        "on: pull_request",
        "permissions: write-all",
        "jobs:",
        "  hostile:",
        "    runs-on: ubuntu-latest",
        "    steps:",
        "      - uses: vendor/network-action@v1",
        `      - run: node -e \"require('node:fs').writeFileSync('${marker.replace(/\\/g, "\\\\")}', 'executed')\"`
      ].join("\n")
    );

    const network = vi.fn(async () => {
      throw new Error("network must not be used by GitHub Actions scanning");
    });
    vi.stubGlobal("fetch", network);
    const capture = captureIo();

    expect(await runCli(["scan", root], { io: capture.io })).toBe(0);
    expect(network).not.toHaveBeenCalled();
    await expect(access(marker)).rejects.toBeTruthy();
  });

  it("keeps workflow names, job names, environment values, and arbitrary strings out of findings", async () => {
    const root = await tempDir();
    const sentinel = "GITHUB_ACTIONS_SOURCE_SENTINEL_4f91";
    await writeFile(
      join(root, ".github", "workflows", "ci.yml"),
      [
        `name: ${sentinel}`,
        "on: workflow_dispatch",
        "permissions: write-all",
        "env:",
        `  INTERNAL_LABEL: ${sentinel}`,
        "jobs:",
        `  ${sentinel}:`,
        "    runs-on: ubuntu-latest",
        "    steps:",
        "      - run: echo ok"
      ].join("\n")
    );

    const terminal = captureIo();
    expect(await runCli(["scan", root], { io: terminal.io })).toBe(0);
    expect(terminal.serialized()).not.toContain(sentinel);

    const json = captureIo();
    expect(await runCli(["scan", root, "--format", "json"], { io: json.io })).toBe(0);
    expect(json.serialized()).not.toContain(sentinel);
  });

  it("publishes GitHub Actions rules through the built-in rule registry", () => {
    const rules = formatBuiltInRuleList();
    expect(rules).toContain("iac/github-actions-untrusted-shell-interpolation\t1.0.0\tUntrusted GitHub context interpolated into shell");
    expect(rules).toContain("iac/github-actions-pull-request-target-code-execution\t1.0.0\tPrivileged pull_request_target executes pull-request code");
    expect(rules).toContain("iac/github-actions-unpinned-third-party-action\t1.0.0\tMutable third-party GitHub Action reference");
  });
});
