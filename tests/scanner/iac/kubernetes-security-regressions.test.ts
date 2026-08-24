import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { formatBuiltInRuleList } from "@/packages/cli/builtins";
import { runCli } from "@/packages/cli/run-cli";

const tempPaths: string[] = [];

async function tempDir() {
  const path = await mkdtemp(join(tmpdir(), "scopeforge-kubernetes-security-"));
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
    serialized: () => JSON.stringify({ stdout, stderr })
  };
}

afterEach(async () => {
  await Promise.all(tempPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("Kubernetes IaC security regressions", () => {
  it("keeps arbitrary resource names and annotations out of terminal and JSON finding evidence", async () => {
    const root = await tempDir();
    const sentinel = "KUBERNETES_SOURCE_SENTINEL_5b32";
    await writeFile(
      join(root, "pod.yaml"),
      [
        "apiVersion: v1",
        "kind: Pod",
        "metadata:",
        `  name: ${sentinel}`,
        "  annotations:",
        `    example.invalid/internal-note: ${sentinel}`,
        "spec:",
        "  hostNetwork: true",
        "  containers:",
        "    - name: app",
        "      image: example.invalid/app:1"
      ].join("\n")
    );

    const terminal = captureIo();
    expect(await runCli(["scan", root], { io: terminal.io })).toBe(0);
    expect(terminal.serialized()).not.toContain(sentinel);

    const json = captureIo();
    expect(await runCli(["scan", root, "--format", "json"], { io: json.io })).toBe(0);
    expect(json.serialized()).not.toContain(sentinel);
  });

  it("publishes Kubernetes rules through the existing built-in rule registry", () => {
    const rules = formatBuiltInRuleList();
    expect(rules).toContain("iac/kubernetes-privileged-container\t1.0.0\tPrivileged Kubernetes container");
    expect(rules).toContain("iac/kubernetes-host-path\t1.0.0\tKubernetes hostPath mount");
    expect(rules).toContain("iac/kubernetes-wildcard-rbac\t1.0.0\tBroad wildcard Kubernetes RBAC");
  });
});
