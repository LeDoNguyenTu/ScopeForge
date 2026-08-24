import { afterEach, describe, expect, it, vi } from "vitest";
import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { formatBuiltInRuleList } from "@/packages/cli/builtins";
import { runCli } from "@/packages/cli/run-cli";

const tempPaths: string[] = [];

async function tempDir() {
  const path = await mkdtemp(join(tmpdir(), "scopeforge-terraform-security-"));
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
  vi.unstubAllGlobals();
  await Promise.all(tempPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("Terraform IaC security regressions", () => {
  it("does not execute provisioners, external data sources, Terraform, or network requests", async () => {
    const root = await tempDir();
    const marker = join(root, "executed-marker.txt");
    await writeFile(
      join(root, "main.tf"),
      [
        "data \"external\" \"dangerous\" {",
        `  program = [\"node\", \"-e\", \"require('node:fs').writeFileSync('${marker.replace(/\\/g, "\\\\")}', 'executed')\"]`,
        "}",
        "",
        "resource \"null_resource\" \"dangerous\" {",
        "  provisioner \"local-exec\" {",
        `    command = \"node -e 'require(\\\"node:fs\\\").writeFileSync(\\\"${marker.replace(/\\/g, "\\\\")}\\\", \\\"executed\\\")'\"`,
        "  }",
        "}",
        "",
        "resource \"aws_db_instance\" \"db\" {",
        "  publicly_accessible = true",
        "}"
      ].join("\n")
    );

    const network = vi.fn(async () => {
      throw new Error("network must not be used by Terraform IaC scanning");
    });
    vi.stubGlobal("fetch", network);
    const capture = captureIo();

    expect(await runCli(["scan", root], { io: capture.io })).toBe(0);
    expect(network).not.toHaveBeenCalled();
    await expect(access(marker)).rejects.toBeTruthy();
  });

  it("keeps resource names, tags, and arbitrary Terraform strings out of terminal and JSON finding evidence", async () => {
    const root = await tempDir();
    const sentinel = "TERRAFORM_SOURCE_SENTINEL_a31c";
    await writeFile(
      join(root, "main.tf"),
      [
        `resource \"aws_db_instance\" \"${sentinel}\" {`,
        "  publicly_accessible = true",
        "  tags = {",
        `    Internal = \"${sentinel}\"`,
        "  }",
        "}"
      ].join("\n")
    );

    const terminal = captureIo();
    expect(await runCli(["scan", root], { io: terminal.io })).toBe(0);
    expect(terminal.serialized()).not.toContain(sentinel);

    const json = captureIo();
    expect(await runCli(["scan", root, "--format", "json"], { io: json.io })).toBe(0);
    expect(json.serialized()).not.toContain(sentinel);
  });

  it("publishes Terraform rules through the existing built-in rule registry", () => {
    const rules = formatBuiltInRuleList();
    expect(rules).toContain("iac/terraform-aws-open-admin-ingress\t1.0.0\tPublic AWS administrative ingress");
    expect(rules).toContain("iac/terraform-aws-public-rds\t1.0.0\tPublicly accessible AWS RDS instance");
    expect(rules).toContain("iac/terraform-aws-wildcard-iam\t1.0.0\tWildcard AWS IAM policy document");
  });
});
