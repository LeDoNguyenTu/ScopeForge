import { describe, expect, it } from "vitest";

import { parseTerraformHcl } from "@/packages/scanner-iac/terraform/parse";

describe("parseTerraformHcl", () => {
  it("parses resource and data blocks without evaluating Terraform expressions", async () => {
    const result = await parseTerraformHcl({
      file: "main.tf",
      content: [
        "variable \"public\" {",
        "  type = bool",
        "}",
        "",
        "resource \"aws_db_instance\" \"db\" {",
        "  publicly_accessible = var.public",
        "  storage_encrypted   = false",
        "}",
        "",
        "data \"aws_iam_policy_document\" \"admin\" {",
        "  statement {",
        "    actions   = [\"*\"]",
        "    resources = [\"*\"]",
        "  }",
        "}"
      ].join("\n")
    });

    expect(result.errors).toEqual([]);
    expect(result.blocks).toHaveLength(2);
    expect(result.blocks.map((block) => [block.kind, block.type, block.name, block.startLine])).toEqual([
      ["resource", "aws_db_instance", "db", 5],
      ["data", "aws_iam_policy_document", "admin", 10]
    ]);
    expect(result.blocks[0]?.value.publicly_accessible).toBe("${var.public}");
    expect(result.blocks[0]?.value.storage_encrypted).toBe(false);
  });

  it("fails closed on malformed HCL without copying repository content into diagnostics", async () => {
    const sentinel = "TERRAFORM_PARSE_SENTINEL_249b";
    const result = await parseTerraformHcl({
      file: "broken.tf",
      content: `resource \"aws_s3_bucket\" \"${sentinel}\" {\n  bucket = \"x\"\n`
    });

    expect(result.blocks).toEqual([]);
    expect(result.errors).toEqual([
      {
        code: "invalid_terraform_hcl",
        file: "broken.tf",
        message: "Terraform HCL contains syntax errors and was not analyzed."
      }
    ]);
    expect(JSON.stringify(result)).not.toContain(sentinel);
  });

  it("enforces a normalized block budget", async () => {
    const result = await parseTerraformHcl(
      {
        file: "many.tf",
        content: [
          "resource \"aws_ebs_volume\" \"one\" { encrypted = true }",
          "resource \"aws_ebs_volume\" \"two\" { encrypted = true }"
        ].join("\n")
      },
      { maxBlocks: 1 }
    );

    expect(result.blocks).toEqual([]);
    expect(result.errors).toEqual([
      {
        code: "terraform_block_budget_exceeded",
        file: "many.tf",
        message: "Terraform HCL exceeded the configured block budget."
      }
    ]);
  });
});
