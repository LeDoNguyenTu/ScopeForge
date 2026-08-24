import { createFindingFingerprint } from "../../scanner-core/findings/fingerprint";
import { compareFindings } from "../../scanner-core/findings/severity";
import type { Finding } from "../../scanner-core/findings/types";
import { TERRAFORM_RULES } from "../rules/terraform";
import type { IacRuleDefinition } from "../rules/types";
import { parseTerraformHcl } from "./parse";
import type {
  ParsedTerraformBlock,
  ScanTerraformHclInput,
  TerraformRecord,
  TerraformScanResult
} from "./types";

const rulesById = new Map(TERRAFORM_RULES.map((rule) => [rule.id, rule]));
const ADMIN_PORTS = [22, 3389] as const;
const PUBLIC_IPV4 = "0.0.0.0/0";
const PUBLIC_IPV6 = "::/0";
const PUBLIC_S3_ACLS = new Set(["public-read", "public-read-write", "authenticated-read"]);
const PUBLIC_ACCESS_FIELDS = [
  "block_public_acls",
  "block_public_policy",
  "ignore_public_acls",
  "restrict_public_buckets"
] as const;

interface FindingDescriptor {
  ruleId: string;
  block: ParsedTerraformBlock;
  structuralContext: string;
  sink: string;
  evidenceSummary: string;
}

function asRecord(value: unknown): TerraformRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as TerraformRecord)
    : null;
}

function records(value: unknown): TerraformRecord[] {
  if (Array.isArray(value)) {
    return value.map(asRecord).filter((item): item is TerraformRecord => item !== null);
  }
  const record = asRecord(value);
  return record ? [record] : [];
}

function staticString(value: unknown): string | null {
  return typeof value === "string" && !value.includes("${") ? value : null;
}

function staticNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function staticBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function literalStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(staticString)
    .filter((item): item is string => item !== null);
}

function ruleEnabled(ruleId: string, input: ScanTerraformHclInput): boolean {
  const selection = input.rules;
  if (!selection) return true;
  if (selection.exclude.includes(ruleId)) return false;
  return selection.include.length === 0 || selection.include.includes(ruleId);
}

function publicNetwork(record: TerraformRecord): boolean {
  if (literalStrings(record.cidr_blocks).includes(PUBLIC_IPV4)) return true;
  if (literalStrings(record.ipv6_cidr_blocks).includes(PUBLIC_IPV6)) return true;
  if (staticString(record.cidr_ipv4) === PUBLIC_IPV4) return true;
  return staticString(record.cidr_ipv6) === PUBLIC_IPV6;
}

function adminOrAllProtocol(record: TerraformRecord): boolean {
  const protocol = staticString(record.ip_protocol ?? record.protocol)?.toLowerCase();
  if (!protocol) return false;
  if (protocol === "-1" || protocol === "all") return true;
  if (protocol !== "tcp" && protocol !== "6") return false;

  const fromPort = staticNumber(record.from_port);
  const toPort = staticNumber(record.to_port);
  if (fromPort === null || toPort === null) return false;
  const low = Math.min(fromPort, toPort);
  const high = Math.max(fromPort, toPort);
  return ADMIN_PORTS.some((port) => port >= low && port <= high);
}

function hasOpenIngress(block: ParsedTerraformBlock): boolean {
  if (block.kind !== "resource") return false;

  if (block.type === "aws_security_group") {
    return records(block.value.ingress).some(
      (ingress) => publicNetwork(ingress) && adminOrAllProtocol(ingress)
    );
  }

  if (block.type === "aws_security_group_rule") {
    return (
      staticString(block.value.type)?.toLowerCase() === "ingress" &&
      publicNetwork(block.value) &&
      adminOrAllProtocol(block.value)
    );
  }

  if (block.type === "aws_vpc_security_group_ingress_rule") {
    return publicNetwork(block.value) && adminOrAllProtocol(block.value);
  }

  return false;
}

function isPublicRds(block: ParsedTerraformBlock): boolean {
  return (
    block.kind === "resource" &&
    block.type === "aws_db_instance" &&
    staticBoolean(block.value.publicly_accessible) === true
  );
}

function isUnencryptedStorage(block: ParsedTerraformBlock): boolean {
  if (block.kind !== "resource") return false;
  if (block.type === "aws_ebs_volume") return staticBoolean(block.value.encrypted) === false;
  if (block.type === "aws_db_instance" || block.type === "aws_rds_cluster") {
    return staticBoolean(block.value.storage_encrypted) === false;
  }
  return false;
}

function hasPublicS3Acl(block: ParsedTerraformBlock): boolean {
  if (block.kind !== "resource") return false;
  if (block.type !== "aws_s3_bucket_acl" && block.type !== "aws_s3_bucket") return false;
  const acl = staticString(block.value.acl)?.toLowerCase();
  return acl ? PUBLIC_S3_ACLS.has(acl) : false;
}

function hasWeakenedPublicAccessBlock(block: ParsedTerraformBlock): boolean {
  if (block.kind !== "resource") return false;
  if (
    block.type !== "aws_s3_bucket_public_access_block" &&
    block.type !== "aws_s3_account_public_access_block"
  ) {
    return false;
  }
  return PUBLIC_ACCESS_FIELDS.some((field) => staticBoolean(block.value[field]) === false);
}

function hasWildcardIamGrant(block: ParsedTerraformBlock): boolean {
  if (block.kind !== "data" || block.type !== "aws_iam_policy_document") return false;

  return records(block.value.statement).some((statement) => {
    const effect = staticString(statement.effect);
    if (effect !== null && effect.toLowerCase() !== "allow") return false;
    return (
      literalStrings(statement.actions).includes("*") &&
      literalStrings(statement.resources).includes("*")
    );
  });
}

function createTerraformFinding(descriptor: FindingDescriptor, file: string): Finding | null {
  const rule = rulesById.get(descriptor.ruleId) as IacRuleDefinition | undefined;
  if (!rule) return null;

  const fingerprint = createFindingFingerprint({
    scanner: "iac",
    ruleId: rule.id,
    file,
    structuralContext: descriptor.structuralContext,
    source: `${descriptor.block.kind}:${descriptor.block.type}:${descriptor.block.name}`,
    sink: descriptor.sink
  });

  return {
    id: fingerprint,
    fingerprint,
    scanner: "iac",
    ruleId: rule.id,
    ruleVersion: rule.version,
    title: rule.title,
    description: rule.description,
    severity: rule.severity,
    confidence: rule.confidence,
    category: "iac",
    validation: "static_confirmed",
    provenance: "observed",
    location: {
      file,
      startLine: descriptor.block.startLine,
      startColumn: 1,
      endLine: descriptor.block.startLine,
      endColumn: 1
    },
    evidence: {
      summary: descriptor.evidenceSummary
    },
    cwe: [...rule.cwe],
    owasp: [...rule.owasp],
    references: [],
    remediation: { ...rule.remediation },
    metadata: {
      blockKind: descriptor.block.kind,
      structuralContext: descriptor.structuralContext
    },
    baselineState: "new"
  };
}

function addDescriptor(
  descriptors: FindingDescriptor[],
  input: ScanTerraformHclInput,
  descriptor: FindingDescriptor
): void {
  if (ruleEnabled(descriptor.ruleId, input)) descriptors.push(descriptor);
}

export async function scanTerraformHcl(input: ScanTerraformHclInput): Promise<TerraformScanResult> {
  const parsed = await parseTerraformHcl(
    { file: input.file, content: input.content },
    input.parser ?? {}
  );
  if (parsed.errors.length > 0) return { findings: [], errors: parsed.errors };

  const descriptors: FindingDescriptor[] = [];
  for (const block of parsed.blocks) {
    if (hasOpenIngress(block)) {
      addDescriptor(descriptors, input, {
        ruleId: "iac/terraform-aws-open-admin-ingress",
        block,
        structuralContext: "Terraform AWS security-group internet ingress",
        sink: "ingress",
        evidenceSummary: "Observed explicit public AWS security-group ingress for an administrative port or all protocols."
      });
    }

    if (isPublicRds(block)) {
      addDescriptor(descriptors, input, {
        ruleId: "iac/terraform-aws-public-rds",
        block,
        structuralContext: "Terraform AWS RDS public accessibility",
        sink: "publicly_accessible",
        evidenceSummary: "Observed an AWS RDS instance with public accessibility explicitly enabled."
      });
    }

    if (isUnencryptedStorage(block)) {
      addDescriptor(descriptors, input, {
        ruleId: "iac/terraform-aws-unencrypted-storage",
        block,
        structuralContext: "Terraform AWS storage encryption",
        sink: "storage_encryption",
        evidenceSummary: "Observed AWS storage encryption explicitly disabled."
      });
    }

    if (hasPublicS3Acl(block)) {
      addDescriptor(descriptors, input, {
        ruleId: "iac/terraform-aws-public-s3-acl",
        block,
        structuralContext: "Terraform AWS S3 ACL exposure",
        sink: "acl",
        evidenceSummary: "Observed an AWS S3 ACL explicitly configured for public or broadly authenticated access."
      });
    }

    if (hasWeakenedPublicAccessBlock(block)) {
      addDescriptor(descriptors, input, {
        ruleId: "iac/terraform-aws-public-access-block-disabled",
        block,
        structuralContext: "Terraform AWS S3 public-access blocking",
        sink: "public_access_block",
        evidenceSummary: "Observed at least one AWS S3 public-access blocking control explicitly disabled."
      });
    }

    if (hasWildcardIamGrant(block)) {
      addDescriptor(descriptors, input, {
        ruleId: "iac/terraform-aws-wildcard-iam",
        block,
        structuralContext: "Terraform AWS IAM wildcard policy grant",
        sink: "statement",
        evidenceSummary: "Observed an AWS IAM policy document statement granting wildcard actions over wildcard resources."
      });
    }
  }

  const findings = descriptors
    .map((descriptor) => createTerraformFinding(descriptor, input.file))
    .filter((finding): finding is Finding => finding !== null)
    .sort(compareFindings);

  return { findings, errors: [] };
}
