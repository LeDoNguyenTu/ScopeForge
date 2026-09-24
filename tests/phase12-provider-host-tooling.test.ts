import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const stagingPath = path.join(root, "scripts/phase12-stage-provider-assets.sh");
const sidecarStagingPath = path.join(root, "scripts/phase12-stage-egress-sidecar.sh");
const preflightPath = path.join(root, "scripts/phase12-provider-host-preflight.sh");
const containmentBundlePath = path.join(root, "scripts/phase12-provider-containment-bundle.sh");
const gitignorePath = path.join(root, ".gitignore");

describe("Phase 12 provider host tooling", () => {
  it("keeps the shell helpers syntactically valid", () => {
    execFileSync("bash", ["-n", stagingPath], { stdio: "pipe" });
    execFileSync("bash", ["-n", sidecarStagingPath], { stdio: "pipe" });
    execFileSync("bash", ["-n", preflightPath], { stdio: "pipe" });
    execFileSync("bash", ["-n", containmentBundlePath], { stdio: "pipe" });
  });

  it("stages only digest-pinned reviewed release artifacts without executing them", async () => {
    const source = await readFile(stagingPath, "utf8");
    expect(source).toContain("sha256sum");
    expect(source).toContain("git hash-object");
    expect(source).toContain("--proto '=https'");
    expect(source).toContain("raw.githubusercontent.com/projectdiscovery/nuclei-templates/$template_commit/$template_path");
    expect(source).toContain("Refusing to overwrite existing provider staging directory");
    expect(source).not.toMatch(/curl[^\n]*\|\s*(?:sh|bash)/);
    expect(source).not.toContain(":latest");
    expect(source).not.toMatch(/\beval\b/);
    expect(source).not.toMatch(/\.\/$binary_name|source\s+.*archive/i);
  });

  it("stages the trusted sidecar without downloads or provider binaries", async () => {
    const source = await readFile(sidecarStagingPath, "utf8");
    expect(source).toContain("provider-egress-sidecar-entry.js");
    expect(source).toContain("sha256sum");
    expect(source).toContain("Refusing to overwrite existing sidecar staging directory");
    expect(source).not.toMatch(/\b(?:curl|wget)\b/);
    expect(source).not.toContain("/opt/scopeforge/bin/httpx");
    expect(source).not.toContain("/opt/scopeforge/bin/nuclei");
  });

  it("keeps image preflight networkless and non-privileged", async () => {
    const source = await readFile(preflightPath, "utf8");
    for (const required of [
      "--network=none",
      "--pull=never",
      "--read-only",
      "--cap-drop=ALL",
      "--security-opt=no-new-privileges",
      "--pids-limit=8",
      "--memory=268435456",
      "--memory-swap=268435456",
      "--cpus=0.5",
      "Rootless Podman is required.",
      "Unified cgroup v2 is required.",
      "egress-sidecar",
    ]) {
      expect(source).toContain(required);
    }
    expect(source).not.toContain("--privileged");
    expect(source).not.toContain("--network=host");
  });


  it("keeps generated provider contexts outside source-dirty acceptance state", async () => {
    const gitignore = await readFile(gitignorePath, "utf8");
    expect(gitignore).toContain(".scopeforge-provider-build/");
  });

  it("bundles only target-free staging, immutable preflight and containment evidence", async () => {
    const source = await readFile(containmentBundlePath, "utf8");
    for (const required of [
      "npm ci --ignore-scripts --no-audit --no-fund",
      "npm run build:workers",
      "phase12-stage-provider-assets.sh",
      "phase12-stage-egress-sidecar.sh",
      "phase12-provider-host-preflight.sh",
      "phase12-provider-linux-containment.sh",
      "PHASE12_PROVIDER_CONTAINMENT_BUNDLE_PASS",
      "ACCEPTANCE_EVIDENCE.txt",
      "provider_image=",
      "sidecar_image=",
      "git -C \"$repo_root\" status --porcelain",
    ]) {
      expect(source).toContain(required);
    }
    expect(source).not.toContain("SCOPEFORGE_WORKER_SECRET");
    expect(source).not.toContain("supabase");
    expect(source).not.toContain("/api/internal/workers");
    expect(source).not.toContain("--network=host");
    expect(source).not.toMatch(/\b(?:register_worker|register-worker|worker-register)\b/i);
  });

  it("does not turn host preflight into production enablement", async () => {
    const source = await readFile(preflightPath, "utf8");
    expect(source).not.toMatch(/\b(?:register_worker|register-worker|worker-register)\b/i);
    expect(source).not.toContain("SCOPEFORGE_WORKER_SECRET");
    expect(source).not.toContain("supabase");
    expect(source).not.toContain("/api/internal/workers");
  });
});
