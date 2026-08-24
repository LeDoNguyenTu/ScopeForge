import { afterEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runCli } from "@/packages/cli/run-cli";
import { SCAN_EXIT } from "@/packages/scanner-core/policy/exit-codes";

const roots: string[] = [];
const githubToken = "ghp_" + "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8";
const secondGithubToken = "ghp_" + "Z9y8X7w6V5u4T3s2R1q0P9o8N7m6L5k4J3i2";

async function tempRepo(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "scopeforge-phase3-e2e-"));
  roots.push(root);
  await mkdir(join(root, "src"), { recursive: true });
  await mkdir(join(root, "deploy"), { recursive: true });
  await mkdir(join(root, ".github", "workflows"), { recursive: true });
  return root;
}

function captureIo() {
  let stdout = "";
  let stderr = "";
  return {
    io: {
      stdout: (value: string) => { stdout += value; },
      stderr: (value: string) => { stderr += value; }
    },
    get stdout() { return stdout; },
    get stderr() { return stderr; }
  };
}

async function writeMixedRepository(root: string): Promise<void> {
  await writeFile(
    join(root, ".scopeforge.json"),
    JSON.stringify({ version: 1, sca: { osv: { enabled: false } } }, null, 2)
  );
  await writeFile(
    join(root, "package.json"),
    JSON.stringify({ name: "phase3-fixture", version: "1.0.0", dependencies: { lodash: "4.17.20" } }, null, 2)
  );
  await writeFile(
    join(root, "package-lock.json"),
    JSON.stringify({
      name: "phase3-fixture",
      version: "1.0.0",
      lockfileVersion: 3,
      packages: {
        "": { name: "phase3-fixture", version: "1.0.0", dependencies: { lodash: "4.17.20" } },
        "node_modules/lodash": { version: "4.17.20" }
      }
    }, null, 2)
  );
  await writeFile(
    join(root, "src", "app.ts"),
    [
      "import express from 'express';",
      "import { exec } from 'node:child_process';",
      `const releaseToken = "${githubToken}";`,
      "const app = express();",
      "app.get('/run', (req, res) => exec(req.query.cmd));"
    ].join("\n")
  );
  await writeFile(join(root, "Dockerfile"), "FROM ubuntu\nUSER node\n");
  await writeFile(
    join(root, "deploy", "deployment.yaml"),
    [
      "apiVersion: apps/v1",
      "kind: Deployment",
      "metadata:",
      "  name: api",
      "spec:",
      "  template:",
      "    spec:",
      "      containers:",
      "        - name: app",
      "          image: example.invalid/app:1",
      "          securityContext:",
      "            privileged: true"
    ].join("\n")
  );
  await writeFile(
    join(root, "deploy", "main.tf"),
    [
      "resource \"aws_db_instance\" \"db\" {",
      "  publicly_accessible = true",
      "  storage_encrypted   = true",
      "}"
    ].join("\n")
  );
  await writeFile(
    join(root, ".github", "workflows", "ci.yml"),
    [
      "name: Privileged",
      "on: workflow_dispatch",
      "permissions: write-all",
      "jobs:",
      "  release:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - run: echo release"
    ].join("\n")
  );
  await writeFile(join(root, ".npmrc"), "strict-ssl=false\n");
  await writeFile(
    join(root, "vercel.json"),
    JSON.stringify({
      headers: [{
        source: "/api/(.*)",
        headers: [{ key: "Access-Control-Allow-Origin", value: "*" }]
      }]
    }, null, 2)
  );
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("Phase 3 mixed-repository end-to-end contract", () => {
  it("runs all local scanner families together without leaking a detected secret", async () => {
    const root = await tempRepo();
    await writeMixedRepository(root);
    const capture = captureIo();

    const exit = await runCli(["scan", root, "--format", "json"], { io: capture.io });
    expect(exit).toBe(SCAN_EXIT.SUCCESS);
    expect(capture.stderr).toBe("");
    expect(capture.stdout).not.toContain(githubToken);

    const parsed = JSON.parse(capture.stdout);
    expect(parsed.errors).toEqual([]);
    expect(parsed.policy).toEqual({ mode: "report-only", passed: true });
    const ruleIds = new Set(parsed.findings.map((finding: { ruleId: string }) => finding.ruleId));
    for (const expected of [
      "secrets/github-token",
      "jsts/command-injection",
      "iac/docker-floating-base-image",
      "iac/kubernetes-privileged-container",
      "iac/terraform-aws-public-rds",
      "iac/github-actions-write-all-permissions",
      "iac/config-npm-strict-ssl-disabled",
      "iac/config-vercel-wildcard-cors"
    ]) {
      expect(ruleIds.has(expected), expected).toBe(true);
    }
    expect(parsed.inventory.manifests).toContain("package-lock.json");
  });

  it("keeps report-only success distinct from explicit policy failure", async () => {
    const root = await tempRepo();
    await writeMixedRepository(root);

    const report = captureIo();
    expect(await runCli(["scan", root, "--format", "json"], { io: report.io })).toBe(SCAN_EXIT.SUCCESS);

    const enforce = captureIo();
    expect(
      await runCli(["scan", root, "--format", "json", "--fail-on", "high"], { io: enforce.io })
    ).toBe(SCAN_EXIT.POLICY_FAILED);
    expect(JSON.parse(enforce.stdout).policy).toMatchObject({ mode: "enforce", passed: false, failOn: "high" });
  });

  it("creates a baseline and fails only when a new high-severity finding is introduced", async () => {
    const root = await tempRepo();
    await writeMixedRepository(root);

    const baselineCreate = captureIo();
    expect(await runCli(["baseline", "create", root], { io: baselineCreate.io })).toBe(SCAN_EXIT.SUCCESS);
    expect(await readFile(join(root, ".scopeforge-baseline.json"), "utf8")).not.toContain(githubToken);

    await writeFile(join(root, "src", "new-secret.ts"), `export const token = "${secondGithubToken}";\n`);

    const capture = captureIo();
    expect(
      await runCli([
        "scan", root,
        "--format", "json",
        "--baseline", ".scopeforge-baseline.json",
        "--fail-on", "high"
      ], { io: capture.io })
    ).toBe(SCAN_EXIT.POLICY_FAILED);

    const parsed = JSON.parse(capture.stdout);
    const newFindings = parsed.findings.filter((finding: { baselineState: string }) => finding.baselineState === "new");
    const existingFindings = parsed.findings.filter((finding: { baselineState: string }) => finding.baselineState === "existing");
    expect(newFindings).toHaveLength(1);
    expect(newFindings[0].ruleId).toBe("secrets/github-token");
    expect(existingFindings.length).toBeGreaterThan(0);
    expect(capture.stdout).not.toContain(secondGithubToken);
  });

  it("emits parseable SARIF and CycloneDX artifacts from the same repository", async () => {
    const root = await tempRepo();
    await writeMixedRepository(root);
    const capture = captureIo();

    expect(
      await runCli([
        "scan", root,
        "--format", "sarif",
        "--output", "scopeforge.sarif",
        "--sbom", "scopeforge.cdx.json"
      ], { io: capture.io })
    ).toBe(SCAN_EXIT.SUCCESS);
    expect(capture.stderr).toBe("");

    const sarifText = await readFile(join(root, "scopeforge.sarif"), "utf8");
    const sbomText = await readFile(join(root, "scopeforge.cdx.json"), "utf8");
    expect(sarifText).not.toContain(githubToken);
    expect(sbomText).not.toContain(githubToken);
    expect(JSON.parse(sarifText)).toMatchObject({ version: "2.1.0" });
    expect(JSON.parse(sbomText)).toMatchObject({ bomFormat: "CycloneDX", specVersion: "1.7" });
  });
});
