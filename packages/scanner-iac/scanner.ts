import type { ScannerRuleSelection } from "../scanner-core/config/types";
import type { Scanner, ScannerDiagnostic, ScannerRunResult } from "../scanner-core/coordinator/types";
import { InventoryReadError, readInventoryEntry } from "../scanner-core/filesystem/read-inventory-entry";
import { compareFindings } from "../scanner-core/findings/severity";
import type { Finding } from "../scanner-core/findings/types";
import { scanDockerfile } from "./docker/scan";
import { scanGitHubActionsYaml } from "./github-actions/scan";
import { scanKubernetesYaml } from "./kubernetes/scan";
import { scanTerraformHcl } from "./terraform/scan";

export interface CreateIacScannerOptions {
  rules?: ScannerRuleSelection;
  maxDockerInstructions?: number;
  maxDockerInstructionBytes?: number;
  maxKubernetesDocuments?: number;
  maxKubernetesAliasCount?: number;
  maxTerraformBlocks?: number;
  maxGitHubActionsAliasCount?: number;
}

function isDockerfile(path: string): boolean {
  const name = path.split("/").at(-1);
  return name === "Dockerfile" || Boolean(name?.startsWith("Dockerfile."));
}

function isYamlFile(path: string): boolean {
  const normalized = path.toLowerCase();
  return normalized.endsWith(".yaml") || normalized.endsWith(".yml");
}

function isTerraformFile(path: string): boolean {
  return path.toLowerCase().endsWith(".tf");
}

function isGitHubActionsWorkflow(path: string): boolean {
  const normalized = path.toLowerCase();
  return (
    normalized.startsWith(".github/workflows/") &&
    (normalized.endsWith(".yaml") || normalized.endsWith(".yml"))
  );
}

function looksLikeKubernetesYaml(content: string): boolean {
  return /^apiVersion\s*:/m.test(content) && /^kind\s*:/m.test(content);
}

function diagnosticForReadError(file: string, error: InventoryReadError): ScannerDiagnostic {
  return {
    code: `filesystem_${error.code}`,
    file,
    message: "Infrastructure file could not be read safely."
  };
}

function collectFindings(
  target: Map<string, Finding>,
  findings: readonly Finding[]
): void {
  for (const finding of findings) {
    if (!target.has(finding.fingerprint)) target.set(finding.fingerprint, finding);
  }
}

export function createIacScanner(options: CreateIacScannerOptions = {}): Scanner {
  return {
    name: "iac",
    version: "1.0.0",
    async scan({ inventory }): Promise<ScannerRunResult> {
      const findingsByFingerprint = new Map<string, Finding>();
      const errors: ScannerDiagnostic[] = [];

      for (const entry of inventory.entries) {
        if (entry.kind !== "infrastructure") continue;
        const dockerfile = isDockerfile(entry.path);
        const yaml = isYamlFile(entry.path);
        const terraform = isTerraformFile(entry.path);
        const githubActions = isGitHubActionsWorkflow(entry.path);
        if (!dockerfile && !yaml && !terraform) continue;

        let content: string;
        try {
          content = await readInventoryEntry(inventory, entry.path);
        } catch (error) {
          if (error instanceof InventoryReadError) {
            errors.push(diagnosticForReadError(entry.path, error));
            continue;
          }
          throw error;
        }

        if (dockerfile) {
          const scanned = scanDockerfile({
            file: entry.path,
            content,
            ...(options.rules ? { rules: options.rules } : {}),
            parser: {
              ...(options.maxDockerInstructions !== undefined
                ? { maxInstructions: options.maxDockerInstructions }
                : {}),
              ...(options.maxDockerInstructionBytes !== undefined
                ? { maxInstructionBytes: options.maxDockerInstructionBytes }
                : {})
            }
          });
          collectFindings(findingsByFingerprint, scanned.findings);
          errors.push(...scanned.errors);
          continue;
        }

        if (terraform) {
          const scanned = await scanTerraformHcl({
            file: entry.path,
            content,
            ...(options.rules ? { rules: options.rules } : {}),
            parser: {
              ...(options.maxTerraformBlocks !== undefined
                ? { maxBlocks: options.maxTerraformBlocks }
                : {})
            }
          });
          collectFindings(findingsByFingerprint, scanned.findings);
          errors.push(...scanned.errors);
          continue;
        }

        if (githubActions) {
          const scanned = scanGitHubActionsYaml({
            file: entry.path,
            content,
            ...(options.rules ? { rules: options.rules } : {}),
            parser: {
              ...(options.maxGitHubActionsAliasCount !== undefined
                ? { maxAliasCount: options.maxGitHubActionsAliasCount }
                : {})
            }
          });
          collectFindings(findingsByFingerprint, scanned.findings);
          errors.push(...scanned.errors);
          continue;
        }

        if (!looksLikeKubernetesYaml(content)) continue;
        const scanned = scanKubernetesYaml({
          file: entry.path,
          content,
          ...(options.rules ? { rules: options.rules } : {}),
          parser: {
            ...(options.maxKubernetesDocuments !== undefined
              ? { maxDocuments: options.maxKubernetesDocuments }
              : {}),
            ...(options.maxKubernetesAliasCount !== undefined
              ? { maxAliasCount: options.maxKubernetesAliasCount }
              : {})
          }
        });
        collectFindings(findingsByFingerprint, scanned.findings);
        errors.push(...scanned.errors);
      }

      return {
        findings: [...findingsByFingerprint.values()].sort(compareFindings),
        errors
      };
    }
  };
}
