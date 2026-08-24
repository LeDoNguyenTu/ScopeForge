import type { IacRuleDefinition } from "./types";

export const GITHUB_ACTIONS_RULES: readonly IacRuleDefinition[] = [
  {
    id: "iac/github-actions-untrusted-shell-interpolation",
    version: "1.0.0",
    title: "Untrusted GitHub context interpolated into shell",
    description: "A GitHub Actions shell step directly interpolates an event field that may contain attacker-controlled text.",
    severity: "high",
    confidence: "high",
    cwe: ["CWE-78"],
    owasp: ["A03:2021"],
    remediation: {
      summary: "Keep untrusted event values out of workflow-generated shell source.",
      guidance: "Pass untrusted event values through step environment variables and quote them as shell data, or use an action that receives the value as a structured input instead of interpolating it into run.",
      verification: "Rescan and confirm shell run steps do not directly interpolate documented untrusted GitHub event fields."
    }
  },
  {
    id: "iac/github-actions-pull-request-target-code-execution",
    version: "1.0.0",
    title: "Privileged pull_request_target executes pull-request code",
    description: "A pull_request_target workflow checks out pull-request-controlled code through an unsafe checkout path and later executes shell commands.",
    severity: "high",
    confidence: "high",
    cwe: ["CWE-829"],
    owasp: ["A08:2021"],
    remediation: {
      summary: "Do not execute pull-request-controlled code in a privileged pull_request_target job.",
      guidance: "Keep pull_request_target jobs limited to trusted base-repository code and metadata operations. Move untrusted code execution to an unprivileged pull_request workflow, or retain checkout protections that reject unsafe fork pull-request refs.",
      verification: "Rescan and confirm privileged pull_request_target jobs do not unsafely check out pull-request code before executable steps."
    }
  },
  {
    id: "iac/github-actions-write-all-permissions",
    version: "1.0.0",
    title: "GitHub Actions write-all token permissions",
    description: "A workflow or job explicitly grants write access to every available GITHUB_TOKEN permission.",
    severity: "medium",
    confidence: "high",
    cwe: ["CWE-732"],
    owasp: ["A05:2021"],
    remediation: {
      summary: "Grant only the token permissions required by the workflow or job.",
      guidance: "Replace write-all with an explicit permissions map and use read or none for scopes that do not require write access.",
      verification: "Rescan and confirm workflow and job permissions no longer use write-all."
    }
  },
  {
    id: "iac/github-actions-unpinned-third-party-action",
    version: "1.0.0",
    title: "Mutable third-party GitHub Action reference",
    description: "A third-party GitHub Action is referenced by a mutable tag or branch instead of an immutable full commit SHA.",
    severity: "medium",
    confidence: "high",
    cwe: ["CWE-829"],
    owasp: ["A08:2021"],
    remediation: {
      summary: "Pin third-party actions to reviewed immutable commit SHAs.",
      guidance: "Replace mutable tags and branches with the full commit SHA for the reviewed action revision. Keep a nearby comment with the human-readable release tag if useful for maintenance.",
      verification: "Rescan and confirm third-party uses references are pinned to full commit SHAs."
    }
  },
  {
    id: "iac/github-actions-self-hosted-pr-code-execution",
    version: "1.0.0",
    title: "Self-hosted runner executes pull-request code",
    description: "A pull_request job uses a self-hosted runner, checks out pull-request code, and later executes shell commands.",
    severity: "medium",
    confidence: "high",
    cwe: ["CWE-829"],
    owasp: ["A08:2021"],
    remediation: {
      summary: "Keep untrusted pull-request code away from persistent self-hosted runners.",
      guidance: "Use GitHub-hosted or strongly isolated ephemeral runners for untrusted pull-request execution, and avoid exposing persistent runner state or credentials to fork-controlled code.",
      verification: "Rescan and confirm pull_request jobs do not check out and execute pull-request code on self-hosted runners."
    }
  },
  {
    id: "iac/github-actions-persisted-write-credentials",
    version: "1.0.0",
    title: "Write-all checkout credentials persist into later steps",
    description: "A checkout step retains broad write-capable GITHUB_TOKEN credentials for later executable steps.",
    severity: "medium",
    confidence: "high",
    cwe: ["CWE-732"],
    owasp: ["A05:2021"],
    remediation: {
      summary: "Do not persist broad checkout credentials when later steps do not require them.",
      guidance: "Set persist-credentials to false and provide narrowly scoped credentials only to the exact step that requires repository write access.",
      verification: "Rescan and confirm checkout credentials are not persisted across later executable steps under write-all permissions."
    }
  }
] as const;

export const GITHUB_ACTIONS_RULE_IDS = GITHUB_ACTIONS_RULES.map((rule) => rule.id);
