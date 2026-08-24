import { IAC_RULES as BASE_IAC_RULES } from "./rules/builtin";
import { TERRAFORM_RULES } from "./rules/terraform";

export { createIacScanner } from "./scanner";
export { parseDockerfile } from "./docker/parse";
export { scanDockerfile } from "./docker/scan";
export { parseKubernetesYaml } from "./kubernetes/parse";
export { scanKubernetesYaml } from "./kubernetes/scan";
export { parseTerraformHcl } from "./terraform/parse";
export { scanTerraformHcl } from "./terraform/scan";
export { TERRAFORM_RULES, TERRAFORM_RULE_IDS } from "./rules/terraform";
export const IAC_RULES = [...BASE_IAC_RULES, ...TERRAFORM_RULES] as const;
export const IAC_RULE_IDS = IAC_RULES.map((rule) => rule.id);
export type { CreateIacScannerOptions } from "./scanner";
export type {
  DockerInstruction,
  DockerParseResult,
  DockerParserOptions,
  DockerScanResult,
  ParseDockerfileInput,
  ScanDockerfileInput
} from "./docker/types";
export type {
  KubernetesLocation,
  KubernetesParseResult,
  KubernetesParserOptions,
  KubernetesPathSegment,
  KubernetesScanResult,
  ParsedKubernetesDocument,
  ParseKubernetesYamlInput,
  ScanKubernetesYamlInput
} from "./kubernetes/types";
export type {
  ParsedTerraformBlock,
  ParseTerraformHclInput,
  ScanTerraformHclInput,
  TerraformBlockKind,
  TerraformParseResult,
  TerraformParserOptions,
  TerraformRecord,
  TerraformScanResult
} from "./terraform/types";
