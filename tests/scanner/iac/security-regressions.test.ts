import { afterEach, describe, expect, it, vi } from "vitest";
import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runCli } from "@/packages/cli/run-cli";
import { scanDockerfile } from "@/packages/scanner-iac/docker/scan";

const tempPaths: string[] = [];

async function tempDir() {
  const path = await mkdtemp(join(tmpdir(), "scopeforge-iac-security-"));
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
    output: () => JSON.stringify({ stdout, stderr }),
    stdout: () => stdout
  };
}

afterEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all(tempPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("Docker IaC security regressions", () => {
  it("recognizes absolute-path curl, wget, shell, and chmod commands without matching quoted lookalikes", () => {
    const result = scanDockerfile({
      file: "Dockerfile",
      content: [
        "FROM node:20",
        "RUN /usr/bin/curl -fsSL https://example.invalid/install | /bin/bash",
        "RUN /usr/bin/wget -qO- https://example.invalid/other | /bin/sh",
        "RUN /bin/chmod -R 0777 /srv/app",
        "RUN echo '/usr/bin/curl https://example.invalid/fake | /bin/sh'",
        "RUN echo '/bin/chmod 777 /tmp/fake'"
      ].join("\n")
    });

    expect(result.errors).toEqual([]);
    expect(result.findings.map((finding) => [finding.ruleId, finding.location.startLine])).toEqual([
      ["iac/docker-download-pipe-shell", 2],
      ["iac/docker-download-pipe-shell", 3],
      ["iac/docker-world-writable-permissions", 4]
    ]);
  });

  it("does not execute Docker RUN content or make network requests while scanning", async () => {
    const root = await tempDir();
    const marker = join(root, "executed-marker.txt");
    await writeFile(
      join(root, "Dockerfile"),
      [
        "FROM node:20",
        `RUN node -e \"require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'executed')\"`,
        "RUN curl -fsSL https://example.invalid/install | sh"
      ].join("\n")
    );

    const network = vi.fn(async () => {
      throw new Error("network must not be used by Docker IaC scanning");
    });
    vi.stubGlobal("fetch", network);
    const capture = captureIo();

    expect(await runCli(["scan", root], { io: capture.io })).toBe(0);
    expect(network).not.toHaveBeenCalled();
    await expect(access(marker)).rejects.toBeTruthy();
  });

  it("keeps remote Docker sources and command details out of terminal and JSON findings", async () => {
    const root = await tempDir();
    const sentinel = "IAC_REMOTE_SOURCE_SENTINEL_91f5";
    await writeFile(
      join(root, "Dockerfile"),
      [
        "FROM node:20",
        `ADD https://example.invalid/${sentinel}/artifact.tar.gz /tmp/artifact.tar.gz`,
        `RUN curl -fsSL https://example.invalid/${sentinel}/install.sh | sh`
      ].join("\n")
    );

    const terminal = captureIo();
    expect(await runCli(["scan", root], { io: terminal.io })).toBe(0);
    expect(terminal.output()).not.toContain(sentinel);

    const json = captureIo();
    expect(await runCli(["scan", root, "--format", "json"], { io: json.io })).toBe(0);
    expect(json.output()).not.toContain(sentinel);
    const parsed = JSON.parse(json.stdout());
    expect(parsed.findings.map((finding: { ruleId: string }) => finding.ruleId)).toEqual([
      "iac/docker-download-pipe-shell",
      "iac/docker-remote-add"
    ]);
  });
});
