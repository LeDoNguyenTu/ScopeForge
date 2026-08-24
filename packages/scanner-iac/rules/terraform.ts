import type { IacRuleDefinition } from "./types";

export const TERRAFORM_RULES: readonly IacRuleDefinition[] = [
  {
    id: "iac/terraform-aws-open-admin-ingress",
    version: "1.0.0",
    title: "Public AWS administrative ingress",
    description: "A Terraform AWS security-group rule explicitly exposes an administrative port or all protocols to the public internet.",
    severity: "high",
    confidence: "high",
    cwe: ["CWE-284"],
    owasp: ["A01:2021", "A05:2021"],
    remediation: {
      summary: "Restrict administrative ingress to trusted network ranges.",
      guidance: "Remove internet-wide CIDRs from administrative and all-protocol ingress rules. Limit access to reviewed private, VPN, bastion, or other explicitly trusted source ranges.",
      verification: "Rescan and confirm no administrative or all-protocol security-group ingress is explicitly open to 0.0.0.0/0 or ::/0."
    }
  },
  {
    id: "iac/terraform-aws-public-rds",
    version: "1.0.0",
    title: "Publicly accessible AWS RDS instance",
    description: "A Terraform AWS RDS database instance explicitly enables public accessibility.",
    severity: "high",
    confidence: "high",
    cwe: ["CWE-668"],
    owasp: ["A05:2021"],
    remediation: {
      summary: "Keep database instances on private network paths.",
      guidance: "Set publicly_accessible to false and reach the database through private subnets, controlled application tiers, VPN, or other reviewed private connectivity.",
      verification: "Rescan and confirm RDS instances do not explicitly enable public accessibility."
    }
  },
  {
    id: "iac/terraform-aws-unencrypted-storage",
    version: "1.0.0",
    title: "AWS storage encryption explicitly disabled",
    description: "A Terraform EBS or RDS storage resource explicitly disables encryption at rest.",
    severity: "high",
    confidence: "high",
    cwe: ["CWE-311"],
    owasp: ["A02:2021"],
    remediation: {
      summary: "Enable encryption at rest for AWS storage.",
      guidance: "Enable the resource encryption setting and use a reviewed AWS managed or customer managed KMS key according to the workload's data-protection requirements.",
      verification: "Rescan and confirm EBS and RDS storage encryption is not explicitly disabled."
    }
  },
  {
    id: "iac/terraform-aws-public-s3-acl",
    version: "1.0.0",
    title: "Public AWS S3 ACL",
    description: "A Terraform S3 bucket ACL explicitly grants public or broadly authenticated access.",
    severity: "high",
    confidence: "high",
    cwe: ["CWE-732"],
    owasp: ["A01:2021", "A05:2021"],
    remediation: {
      summary: "Use private S3 ACLs and explicit least-privileged policies.",
      guidance: "Replace public or broadly authenticated ACLs with private ownership controls and narrowly scoped bucket or identity policies where access is required.",
      verification: "Rescan and confirm S3 ACLs are not explicitly configured for public or authenticated-read access."
    }
  },
  {
    id: "iac/terraform-aws-public-access-block-disabled",
    version: "1.0.0",
    title: "AWS S3 public-access blocking weakened",
    description: "A Terraform S3 public-access block explicitly disables at least one protective control.",
    severity: "medium",
    confidence: "high",
    cwe: ["CWE-732"],
    owasp: ["A05:2021"],
    remediation: {
      summary: "Enable all applicable S3 public-access blocking controls.",
      guidance: "Keep block_public_acls, block_public_policy, ignore_public_acls, and restrict_public_buckets enabled unless a narrowly reviewed exception requires otherwise.",
      verification: "Rescan and confirm S3 public-access block controls are not explicitly disabled."
    }
  },
  {
    id: "iac/terraform-aws-wildcard-iam",
    version: "1.0.0",
    title: "Wildcard AWS IAM policy document",
    description: "A Terraform AWS IAM policy document contains an allow statement with wildcard actions over wildcard resources.",
    severity: "high",
    confidence: "high",
    cwe: ["CWE-732"],
    owasp: ["A01:2021"],
    remediation: {
      summary: "Replace wildcard IAM grants with least-privileged actions and resources.",
      guidance: "Enumerate only the API actions and resource ARNs required by the principal, and add conditions where they further constrain the intended access path.",
      verification: "Rescan and confirm IAM policy documents no longer allow wildcard actions over wildcard resources."
    }
  }
] as const;

export const TERRAFORM_RULE_IDS = TERRAFORM_RULES.map((rule) => rule.id);
