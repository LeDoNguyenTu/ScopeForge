import { createFindingFingerprint } from "../../scanner-core/findings/fingerprint";
import { compareFindings } from "../../scanner-core/findings/severity";
import type { Finding } from "../../scanner-core/findings/types";
import { GITHUB_ACTIONS_RULES } from "../rules/github-actions";
import type { IacRuleDefinition } from "../rules/types";
import { parseGitHubActionsYaml } from "./parse";
import type {
  GitHubActionsLocation,
  GitHubActionsPathSegment,
  ParsedGitHubActionsWorkflow,
  ScanGitHubActionsYamlInput,
  GitHubActionsScanResult
} from "./types";

const rulesById = new Map(GITHUB_ACTIONS_RULES.map((rule) => [rule.id, rule]));
const FULL_COMMIT_SHA = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i;
const CHECKOUT_ACTION = /^actions\/checkout@(.+)$/i;
const UNTRUSTED_SHELL_CONTEXTS = [
  "github.event.pull_request.title",
  "github.event.pull_request.body",
  "github.event.issue.title",
  "github.event.issue.body",
  "github.event.comment.body",
  "github.event.review.body",
  "github.event.review_comment.body",
  "github.event.discussion.title",
  "github.event.discussion.body",
  "github.event.head_commit.message",
  "github.head_ref",
  "github.event.pull_request.head.ref"
] as const;

interface FindingDescriptor {
  ruleId: string;
  locationPath: readonly GitHubActionsPathSegment[];
  structuralContext: string;
  sourceIdentity: string;
  sink: string;
  evidenceSummary: string;
}

interface CheckoutStep {
  index: number;
  step: Record<string, unknown>;
  versionRef: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return null;
  if (value.toLowerCase() === "true") return true;
  if (value.toLowerCase() === "false") return false;
  return null;
}

function ruleEnabled(ruleId: string, input: ScanGitHubActionsYamlInput): boolean {
  const selection = input.rules;
  if (!selection) return true;
  if (selection.exclude.includes(ruleId)) return false;
  return selection.include.length === 0 || selection.include.includes(ruleId);
}

function hasTrigger(on: unknown, event: string): boolean {
  if (typeof on === "string") return on === event;
  if (Array.isArray(on)) return on.some((value) => value === event);
  const mapping = asRecord(on);
  return mapping ? Object.prototype.hasOwnProperty.call(mapping, event) : false;
}

function isWriteAll(value: unknown): boolean {
  return typeof value === "string" && value.toLowerCase() === "write-all";
}

function expressions(value: string): string[] {
  return [...value.matchAll(/\$\{\{\s*([^}]+?)\s*\}\}/g)]
    .map((match) => match[1]?.trim().toLowerCase())
    .filter((expression): expression is string => Boolean(expression));
}

function hasUntrustedShellInterpolation(run: unknown): boolean {
  const command = asString(run);
  if (!command) return false;
  return expressions(command).some((expression) =>
    UNTRUSTED_SHELL_CONTEXTS.some((context) =>
      new RegExp(`(^|[^a-z0-9_.])${context.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9_.]|$)`, "i")
        .test(expression)
    )
  );
}

function isThirdPartyMutableAction(uses: unknown): boolean {
  const reference = asString(uses)?.trim();
  if (!reference || reference.startsWith("./") || reference.startsWith("docker://")) return false;

  const at = reference.lastIndexOf("@");
  if (at <= 0 || at === reference.length - 1) return false;
  const target = reference.slice(0, at);
  const revision = reference.slice(at + 1);
  if (FULL_COMMIT_SHA.test(revision)) return false;

  const owner = target.split("/")[0]?.toLowerCase();
  if (!owner || owner === "actions" || owner === "github") return false;
  return target.includes("/");
}

function checkoutStep(step: Record<string, unknown>, index: number): CheckoutStep | null {
  const uses = asString(step.uses)?.trim();
  const match = uses?.match(CHECKOUT_ACTION);
  if (!match?.[1]) return null;
  return { index, step, versionRef: match[1] };
}

function checkoutSteps(steps: readonly unknown[]): CheckoutStep[] {
  const result: CheckoutStep[] = [];
  for (let index = 0; index < steps.length; index += 1) {
    const step = asRecord(steps[index]);
    if (!step) continue;
    const checkout = checkoutStep(step, index);
    if (checkout) result.push(checkout);
  }
  return result;
}

function hasLaterRun(steps: readonly unknown[], index: number): boolean {
  return steps.slice(index + 1).some((candidate) => {
    const step = asRecord(candidate);
    return Boolean(step && asString(step.run)?.trim());
  });
}

function checkoutWith(step: Record<string, unknown>): Record<string, unknown> {
  return asRecord(step.with) ?? {};
}

function referencesPullRequestHead(value: unknown): boolean {
  const text = asString(value)?.toLowerCase();
  if (!text) return false;
  return (
    text.includes("github.event.pull_request.head.sha") ||
    text.includes("github.event.pull_request.head.ref") ||
    text.includes("github.event.pull_request.head.repo.full_name")
  );
}

function checkoutPullRequestHead(checkout: CheckoutStep): boolean {
  const withInputs = checkoutWith(checkout.step);
  return referencesPullRequestHead(withInputs.ref) || referencesPullRequestHead(withInputs.repository);
}

function checkoutV7ProtectionApplies(checkout: CheckoutStep): boolean {
  const withInputs = checkoutWith(checkout.step);
  if (asBoolean(withInputs["allow-unsafe-pr-checkout"]) === true) return false;
  if (FULL_COMMIT_SHA.test(checkout.versionRef)) return true;
  return /^v7(?:$|[.\-])/.test(checkout.versionRef.toLowerCase());
}

function checkoutDefaultsToPullRequestCode(checkout: CheckoutStep): boolean {
  const withInputs = checkoutWith(checkout.step);
  if (withInputs.ref === undefined && withInputs.repository === undefined) return true;
  return referencesPullRequestHead(withInputs.ref) || referencesPullRequestHead(withInputs.repository);
}

function persistsCredentials(checkout: CheckoutStep): boolean {
  const value = checkoutWith(checkout.step)["persist-credentials"];
  return asBoolean(value) !== false;
}

function usesSelfHostedRunner(value: unknown): boolean {
  if (typeof value === "string") return value.toLowerCase() === "self-hosted";
  return Array.isArray(value)
    ? value.some((item) => typeof item === "string" && item.toLowerCase() === "self-hosted")
    : false;
}

function createFinding(
  descriptor: FindingDescriptor,
  workflow: ParsedGitHubActionsWorkflow,
  file: string
): Finding | null {
  const rule = rulesById.get(descriptor.ruleId) as IacRuleDefinition | undefined;
  if (!rule) return null;

  const fingerprint = createFindingFingerprint({
    scanner: "iac",
    ruleId: rule.id,
    file,
    structuralContext: descriptor.structuralContext,
    source: descriptor.sourceIdentity,
    sink: descriptor.sink
  });
  const location: GitHubActionsLocation = workflow.location(descriptor.locationPath) ?? {
    startLine: 1,
    startColumn: 1,
    endLine: 1,
    endColumn: 1
  };

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
    location: { file, ...location },
    evidence: { summary: descriptor.evidenceSummary },
    cwe: [...rule.cwe],
    owasp: [...rule.owasp],
    references: [],
    remediation: { ...rule.remediation },
    metadata: { structuralContext: descriptor.structuralContext },
    baselineState: "new"
  };
}

function add(
  descriptors: FindingDescriptor[],
  input: ScanGitHubActionsYamlInput,
  descriptor: FindingDescriptor
): void {
  if (ruleEnabled(descriptor.ruleId, input)) descriptors.push(descriptor);
}

export function scanGitHubActionsYaml(input: ScanGitHubActionsYamlInput): GitHubActionsScanResult {
  const parsed = parseGitHubActionsYaml(
    { file: input.file, content: input.content },
    input.parser ?? {}
  );
  if (parsed.errors.length > 0 || !parsed.workflow) {
    return { findings: [], errors: parsed.errors };
  }

  const workflow = parsed.workflow;
  const root = asRecord(workflow.value);
  if (!root) return { findings: [], errors: [] };

  const descriptors: FindingDescriptor[] = [];
  const workflowWriteAll = isWriteAll(root.permissions);
  if (workflowWriteAll) {
    add(descriptors, input, {
      ruleId: "iac/github-actions-write-all-permissions",
      locationPath: ["permissions"],
      structuralContext: "GitHub Actions workflow token permissions",
      sourceIdentity: "workflow",
      sink: "permissions",
      evidenceSummary: "Observed workflow-level GITHUB_TOKEN permissions explicitly set to write-all."
    });
  }

  const jobs = asRecord(root.jobs);
  if (!jobs) {
    const findings = descriptors
      .map((descriptor) => createFinding(descriptor, workflow, input.file))
      .filter((finding): finding is Finding => finding !== null)
      .sort(compareFindings);
    return { findings, errors: [] };
  }

  const pullRequest = hasTrigger(root.on, "pull_request");
  const pullRequestTarget = hasTrigger(root.on, "pull_request_target");

  for (const [jobName, jobValue] of Object.entries(jobs)) {
    const job = asRecord(jobValue);
    if (!job) continue;
    const jobPermissionsSpecified = Object.prototype.hasOwnProperty.call(job, "permissions");
    const jobWriteAll = isWriteAll(job.permissions);
    const effectiveWriteAll = jobPermissionsSpecified ? jobWriteAll : workflowWriteAll;

    if (jobWriteAll) {
      add(descriptors, input, {
        ruleId: "iac/github-actions-write-all-permissions",
        locationPath: ["jobs", jobName, "permissions"],
        structuralContext: "GitHub Actions job token permissions",
        sourceIdentity: `job:${jobName}`,
        sink: "permissions",
        evidenceSummary: "Observed job-level GITHUB_TOKEN permissions explicitly set to write-all."
      });
    }

    const steps = Array.isArray(job.steps) ? job.steps : [];
    for (let index = 0; index < steps.length; index += 1) {
      const step = asRecord(steps[index]);
      if (!step) continue;

      if (hasUntrustedShellInterpolation(step.run)) {
        add(descriptors, input, {
          ruleId: "iac/github-actions-untrusted-shell-interpolation",
          locationPath: ["jobs", jobName, "steps", index, "run"],
          structuralContext: "GitHub Actions direct event-to-shell interpolation",
          sourceIdentity: `job:${jobName}:step:${index}`,
          sink: "run",
          evidenceSummary: "Observed direct interpolation of a documented untrusted GitHub event field into a shell run step."
        });
      }

      if (isThirdPartyMutableAction(step.uses)) {
        add(descriptors, input, {
          ruleId: "iac/github-actions-unpinned-third-party-action",
          locationPath: ["jobs", jobName, "steps", index, "uses"],
          structuralContext: "GitHub Actions third-party action integrity",
          sourceIdentity: `job:${jobName}:action:${asString(step.uses) ?? index}`,
          sink: "uses",
          evidenceSummary: "Observed a third-party action referenced by a mutable revision rather than a full immutable commit SHA."
        });
      }
    }

    const checkouts = checkoutSteps(steps);
    for (const checkout of checkouts) {
      if (
        pullRequestTarget &&
        checkoutPullRequestHead(checkout) &&
        !checkoutV7ProtectionApplies(checkout) &&
        hasLaterRun(steps, checkout.index)
      ) {
        add(descriptors, input, {
          ruleId: "iac/github-actions-pull-request-target-code-execution",
          locationPath: ["jobs", jobName, "steps", checkout.index, "uses"],
          structuralContext: "GitHub Actions privileged pull-request checkout and execution",
          sourceIdentity: `job:${jobName}:checkout:${checkout.index}`,
          sink: "run-after-checkout",
          evidenceSummary: "Observed pull_request_target checking out pull-request-controlled code through an unsafe checkout path before a later shell run step."
        });
      }

      if (
        pullRequest &&
        usesSelfHostedRunner(job["runs-on"]) &&
        checkoutDefaultsToPullRequestCode(checkout) &&
        hasLaterRun(steps, checkout.index)
      ) {
        add(descriptors, input, {
          ruleId: "iac/github-actions-self-hosted-pr-code-execution",
          locationPath: ["jobs", jobName, "runs-on"],
          structuralContext: "GitHub Actions self-hosted pull-request execution",
          sourceIdentity: `job:${jobName}`,
          sink: "self-hosted-runner",
          evidenceSummary: "Observed a self-hosted pull_request job that checks out pull-request code before a later shell run step."
        });
      }

      if (
        effectiveWriteAll &&
        persistsCredentials(checkout) &&
        hasLaterRun(steps, checkout.index)
      ) {
        add(descriptors, input, {
          ruleId: "iac/github-actions-persisted-write-credentials",
          locationPath: ["jobs", jobName, "steps", checkout.index, "uses"],
          structuralContext: "GitHub Actions persisted broad checkout credentials",
          sourceIdentity: `job:${jobName}:checkout:${checkout.index}`,
          sink: "persist-credentials",
          evidenceSummary: "Observed checkout credentials retained under effective write-all token permissions before a later shell run step."
        });
      }
    }
  }

  const findings = descriptors
    .map((descriptor) => createFinding(descriptor, workflow, input.file))
    .filter((finding): finding is Finding => finding !== null)
    .sort(compareFindings);

  return { findings, errors: [] };
}
