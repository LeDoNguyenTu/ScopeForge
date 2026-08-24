import { CONFIG_RULES } from "./rules/config";
import { IAC_RULES as BASE_IAC_RULES } from "./rules/builtin";
import { GITHUB_ACTIONS_RULES } from "./rules/github-actions";
import { TERRAFORM_RULES } from "./rules/terraform";

export { createIacScanner } from "./scanner";
export { scanSecurityConfig } from "./config/scan";
export { parseDockerfile } from "./docker/parse";
export { scanDockerfile } from "./docker/scan";
export { parseGitHubActionsYaml } from "./github-actions/parse";
export { scanGitHubActionsYaml } from "./github-actions/scan";
export { parseKubernetesYaml } from "./kubernetes/parse";
export { scanKubernetesYaml } from "./kubernetes/scan";
export { parseTerraformHcl } from "./terraform/parse";
export { scanTerraformHcl } from "./terraform/scan";
export { CONFIG_RULES, CONFIG_RULE_IDS } from "./rules/config";
export { GITHUB_ACTIONS_RULES, GITHUB_ACTIONS_RULE_IDS } from "./rules/github-actions";
export { TERRAFORM_RULES, TERRAFORM_RULE_IDS } from "./rules/terraform";
export const IAC_RULES = [
  ...BASE_IAC_RULES,
  ...TERRAFORM_RULES,
  ...GITHUB_ACTIONS_RULES,
  ...CONFIG_RULES
] as const;
export const IAC_RULE_IDS = IAC_RULES.map((rule) => rule.id);
export type { CreateIacScannerOptions } from "./scanner";
export type {
  ScanSecurityConfigInput,
  SecurityConfigKind,
  SecurityConfigScanResult
} from "./config/types";
export type {
  DockerInstruction,
  DockerParseResult,
  DockerParserOptions,
  DockerScanResult,
  ParseDockerfileInput,
  ScanDockerfileInput
} from "./docker/types";
export type {
  GitHubActionsLocation,
  GitHubActionsParseResult,
  GitHubActionsParserOptions,
  GitHubActionsPathSegment,
  GitHubActionsScanResult,
  ParsedGitHubActionsWorkflow,
  ParseGitHubActionsYamlInput,
  ScanGitHubActionsYamlInput
} from "./github-actions/types";
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
