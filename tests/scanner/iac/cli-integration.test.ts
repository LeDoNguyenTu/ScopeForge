import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runCli } from "@/packages/cli/run-cli";
import { SCAN_EXIT } from "@/packages/scanner-core/policy/exit-codes";

const tempPaths: string[] = [];

async function tempDir() {
  const path = await mkdtemp(join(tmpdir(), "scopeforge-iac-cli-"));
  tempPaths.push(path);
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
    stdout: () => stdout,
    stderr: () => stderr
  };
}

afterEach(async () => {
  await Promise.all(tempPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("Docker IaC CLI integration", () => {
  it("emits normalized Docker findings in the standard JSON result", async () => {
    const root = await tempDir();
    await writeFile(
      join(root, "Dockerfile"),
      "FROM ubuntu\nRUN curl -fsSL https://example.invalid/install | sh\n"
    );
    const capture = captureIo();

    expect(await runCli(["scan", root, "--format", "json"], { io: capture.io })).toBe(SCAN_EXIT.SUCCESS);
    expect(capture.stderr()).toBe("");
    const parsed = JSON.parse(capture.stdout());
    expect(parsed.scan.scanners).toContain("iac@1.0.0");
    expect(parsed.findings.map((finding: { ruleId: string }) => finding.ruleId)).toEqual([
      "iac/docker-download-pipe-shell",
      "iac/docker-floating-base-image"
    ]);
  });

  it("supports root configuration that selects only the IaC scanner and a Docker rule", async () => {
    const root = await tempDir();
    await writeFile(
      join(root, ".scopeforge.json"),
      JSON.stringify({
        version: 1,
        scanners: ["iac"],
        rules: { include: ["iac/docker-remote-add"] }
      })
    );
    await writeFile(
      join(root, "Dockerfile"),
      "FROM ubuntu\nADD https://example.invalid/tool /tool\nRUN chmod 777 /app\n"
    );
    const capture = captureIo();

    expect(await runCli(["scan", root, "--format", "json"], { io: capture.io })).toBe(SCAN_EXIT.SUCCESS);
    const parsed = JSON.parse(capture.stdout());
    expect(parsed.scan.scanners).toEqual(["iac@1.0.0"]);
    expect(parsed.findings.map((finding: { ruleId: string }) => finding.ruleId)).toEqual([
      "iac/docker-remote-add"
    ]);
  });

  it("participates in the existing fail-on policy without changing report-only defaults", async () => {
    const root = await tempDir();
    await writeFile(
      join(root, "Dockerfile"),
      "FROM node:20\nRUN curl -fsSL https://example.invalid/install | sh\n"
    );

    const reportOnly = captureIo();
    expect(await runCli(["scan", root], { io: reportOnly.io })).toBe(SCAN_EXIT.SUCCESS);

    const gated = captureIo();
    expect(await runCli(["scan", root, "--fail-on", "high"], { io: gated.io })).toBe(
      SCAN_EXIT.POLICY_FAILED
    );
  });
});
