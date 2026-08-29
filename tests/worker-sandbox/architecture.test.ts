import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SANDBOX_FILES = [
  "packages/worker-sandbox/types.ts",
  "packages/worker-sandbox/podman-command.ts",
  "packages/worker-sandbox/podman-runtime.ts",
  "packages/worker-sandbox/index.ts",
];

const FORBIDDEN = [
  "@supabase/",
  "supabase-js",
  "worker-control",
  "runtime-network",
  "repository-acquisition",
  "repository-snapshot/executor",
  "scanner-core",
  "scanner-jsts",
  "scanner-sca",
  "scanner-secrets",
  "scanner-iac",
  "phase3-import",
  "model-providers",
  "r2-signature",
  "github.com",
];

describe("Phase 6C sandbox architecture", () => {
  it("keeps scanner, storage, database, network, and control authority outside the sandbox adapter", async () => {
    for (const relativePath of SANDBOX_FILES) {
      const source = await readFile(path.resolve(relativePath), "utf8");
      for (const forbidden of FORBIDDEN) {
        expect(source, `${relativePath} must not contain ${forbidden}`).not.toContain(forbidden);
      }
    }
  });

  it("allows child-process authority only in the reviewed Podman runtime adapter", async () => {
    for (const relativePath of SANDBOX_FILES) {
      const source = await readFile(path.resolve(relativePath), "utf8");
      if (relativePath.endsWith("podman-runtime.ts")) {
        expect(source).toContain('from "node:child_process"');
      } else {
        expect(source).not.toContain("node:child_process");
      }
    }
  });

  it("contains the mandatory zero-egress and host-hardening flags in one closed command builder", async () => {
    const source = await readFile(path.resolve("packages/worker-sandbox/podman-command.ts"), "utf8");
    for (const required of [
      "--pull=never",
      "--network=none",
      "--read-only",
      "--cap-drop=all",
      "--security-opt=no-new-privileges",
      "--pids-limit=64",
      "--memory=1g",
      "--cgroup-conf=memory.swap.max=0",
      "--cpus=1",
      "--log-driver=none",
      "--unsetenv-all",
    ]) {
      expect(source).toContain(required);
    }
    expect(source).not.toContain("exec(");
    expect(source).not.toContain("spawn(");
  });
});