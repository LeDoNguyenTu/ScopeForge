import { describe, expect, it } from "vitest";

import { scanTerraformHcl } from "@/packages/scanner-iac/terraform/scan";

async function ruleIds(content: string): Promise<string[]> {
  const result = await scanTerraformHcl({ file: "main.tf", content });
  expect(result.errors).toEqual([]);
  return result.findings.map((finding) => finding.ruleId).sort();
}

describe("Terraform IaC rules", () => {
  it("flags public admin ingress but not public HTTPS-only ingress or unresolved CIDRs", async () => {
    expect(
      await ruleIds([
        "resource \"aws_security_group\" \"admin\" {",
        "  ingress {",
        "    from_port   = 22",
        "    to_port     = 22",
        "    protocol    = \"tcp\"",
        "    cidr_blocks = [\"0.0.0.0/0\"]",
        "  }",
        "}",
        "",
        "resource \"aws_security_group\" \"https\" {",
        "  ingress {",
        "    from_port   = 443",
        "    to_port     = 443",
        "    protocol    = \"tcp\"",
        "    cidr_blocks = [\"0.0.0.0/0\"]",
        "  }",
        "}",
        "",
        "resource \"aws_security_group\" \"dynamic\" {",
        "  ingress {",
        "    from_port   = 22",
        "    to_port     = 22",
        "    protocol    = \"tcp\"",
        "    cidr_blocks = var.admin_cidrs",
        "  }",
        "}"
      ].join("\n"))
    ).toEqual(["iac/terraform-aws-open-admin-ingress"]);
  });

  it("flags explicitly public RDS and explicitly disabled storage encryption", async () => {
    expect(
      await ruleIds([
        "resource \"aws_db_instance\" \"db\" {",
        "  publicly_accessible = true",
        "  storage_encrypted   = false",
        "}",
        "",
        "resource \"aws_ebs_volume\" \"data\" {",
        "  encrypted = false",
        "}",
        "",
        "resource \"aws_db_instance\" \"dynamic\" {",
        "  publicly_accessible = var.public",
        "  storage_encrypted   = var.encrypt",
        "}"
      ].join("\n"))
    ).toEqual([
      "iac/terraform-aws-public-rds",
      "iac/terraform-aws-unencrypted-storage",
      "iac/terraform-aws-unencrypted-storage"
    ]);
  });

  it("flags public S3 ACLs and disabled public-access blocking only when explicit", async () => {
    expect(
      await ruleIds([
        "resource \"aws_s3_bucket_acl\" \"public\" {",
        "  acl = \"public-read\"",
        "}",
        "",
        "resource \"aws_s3_bucket_public_access_block\" \"weak\" {",
        "  block_public_acls       = false",
        "  block_public_policy     = true",
        "  ignore_public_acls      = true",
        "  restrict_public_buckets = true",
        "}",
        "",
        "resource \"aws_s3_bucket_acl\" \"private\" {",
        "  acl = \"private\"",
        "}"
      ].join("\n"))
    ).toEqual([
      "iac/terraform-aws-public-access-block-disabled",
      "iac/terraform-aws-public-s3-acl"
    ]);
  });

  it("flags wildcard IAM policy documents while accepting scoped statements", async () => {
    expect(
      await ruleIds([
        "data \"aws_iam_policy_document\" \"admin\" {",
        "  statement {",
        "    actions   = [\"*\"]",
        "    resources = [\"*\"]",
        "  }",
        "}",
        "",
        "data \"aws_iam_policy_document\" \"reader\" {",
        "  statement {",
        "    actions   = [\"s3:GetObject\"]",
        "    resources = [\"arn:aws:s3:::example/*\"]",
        "  }",
        "}"
      ].join("\n"))
    ).toEqual(["iac/terraform-aws-wildcard-iam"]);
  });

  it("flags all-protocol internet ingress through standalone AWS security-group rules", async () => {
    expect(
      await ruleIds([
        "resource \"aws_security_group_rule\" \"all\" {",
        "  type        = \"ingress\"",
        "  protocol    = \"-1\"",
        "  from_port   = 0",
        "  to_port     = 0",
        "  cidr_blocks = [\"0.0.0.0/0\"]",
        "}",
        "",
        "resource \"aws_vpc_security_group_ingress_rule\" \"ipv6\" {",
        "  ip_protocol = \"-1\"",
        "  cidr_ipv6   = \"::/0\"",
        "}"
      ].join("\n"))
    ).toEqual([
      "iac/terraform-aws-open-admin-ingress",
      "iac/terraform-aws-open-admin-ingress"
    ]);
  });
});
