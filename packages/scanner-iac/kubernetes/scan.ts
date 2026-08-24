import { createFindingFingerprint } from "../../scanner-core/findings/fingerprint";
import { compareFindings } from "../../scanner-core/findings/severity";
import type { Finding } from "../../scanner-core/findings/types";
import { IAC_RULES } from "../rules/builtin";
import type { IacRuleDefinition } from "../rules/types";
import { parseKubernetesYaml } from "./parse";
import type {
  KubernetesLocation,
  KubernetesPathSegment,
  KubernetesScanResult,
  ParsedKubernetesDocument,
  ScanKubernetesYamlInput
} from "./types";

const rulesById = new Map(IAC_RULES.map((rule) => [rule.id, rule]));
const HIGH_RISK_CAPABILITIES = new Set([
  "ALL",
  "DAC_OVERRIDE",
  "NET_ADMIN",
  "SYS_ADMIN",
  "SYS_MODULE",
  "SYS_PTRACE"
]);

interface FindingDescriptor {
  ruleId: string;
  document: ParsedKubernetesDocument;
  path: KubernetesPathSegment[];
  structuralContext: string;
  evidenceSummary: string;
}

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function valueAt(value: unknown, path: readonly KubernetesPathSegment[]): unknown {
  let current = value;
  for (const segment of path) {
    if (typeof segment === "number") {
      if (!Array.isArray(current)) return undefined;
      current = current[segment];
      continue;
    }
    const record = asRecord(current);
    if (!record) return undefined;
    current = record[segment];
  }
  return current;
}

function stringAt(value: unknown, path: readonly KubernetesPathSegment[]): string | null {
  const candidate = valueAt(value, path);
  return typeof candidate === "string" ? candidate : null;
}

function numberAt(value: unknown, path: readonly KubernetesPathSegment[]): number | null {
  const candidate = valueAt(value, path);
  return typeof candidate === "number" && Number.isFinite(candidate) ? candidate : null;
}

function booleanAt(value: unknown, path: readonly KubernetesPathSegment[]): boolean | null {
  const candidate = valueAt(value, path);
  return typeof candidate === "boolean" ? candidate : null;
}

function stringArrayAt(value: unknown, path: readonly KubernetesPathSegment[]): string[] {
  const candidate = valueAt(value, path);
  if (!Array.isArray(candidate)) return [];
  return candidate.filter((item): item is string => typeof item === "string");
}

function ruleEnabled(ruleId: string, selection: ScanKubernetesYamlInput["rules"]): boolean {
  if (!selection) return true;
  if (selection.exclude.includes(ruleId)) return false;
  return selection.include.length === 0 || selection.include.includes(ruleId);
}

function podSpecPath(kind: string | null): KubernetesPathSegment[] | null {
  switch (kind) {
    case "Pod":
      return ["spec"];
    case "Deployment":
    case "StatefulSet":
    case "DaemonSet":
    case "ReplicaSet":
    case "Job":
      return ["spec", "template", "spec"];
    case "CronJob":
      return ["spec", "jobTemplate", "spec", "template", "spec"];
    default:
      return null;
  }
}

function resourceIdentity(document: ParsedKubernetesDocument): string {
  const name = stringAt(document.value, ["metadata", "name"]);
  const kind = document.kind ?? "unknown";
  return name ? `${kind}:${name}` : `${kind}:document-${document.index}`;
}

function findingLocation(
  document: ParsedKubernetesDocument,
  path: readonly KubernetesPathSegment[]
): KubernetesLocation {
  return (
    document.location(path) ??
    document.location(["kind"]) ?? {
      startLine: 1,
      startColumn: 1,
      endLine: 1,
      endColumn: 1
    }
  );
}

function pathKey(path: readonly KubernetesPathSegment[]): string {
  return path.map((segment) => String(segment)).join("/");
}

function createKubernetesFinding(descriptor: FindingDescriptor, file: string): Finding | null {
  const rule = rulesById.get(descriptor.ruleId) as IacRuleDefinition | undefined;
  if (!rule) return null;

  const location = findingLocation(descriptor.document, descriptor.path);
  const fingerprint = createFindingFingerprint({
    scanner: "iac",
    ruleId: rule.id,
    file,
    structuralContext: descriptor.structuralContext,
    source: resourceIdentity(descriptor.document),
    sink: pathKey(descriptor.path)
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
      startLine: location.startLine,
      startColumn: location.startColumn,
      endLine: location.endLine,
      endColumn: location.endColumn
    },
    evidence: {
      summary: descriptor.evidenceSummary
    },
    cwe: [...rule.cwe],
    owasp: [...rule.owasp],
    references: [],
    remediation: { ...rule.remediation },
    metadata: {
      manifestKind: descriptor.document.kind ?? "unknown",
      structuralContext: descriptor.structuralContext
    },
    baselineState: "new"
  };
}

function addDescriptor(
  descriptors: FindingDescriptor[],
  input: ScanKubernetesYamlInput,
  descriptor: FindingDescriptor
): void {
  if (ruleEnabled(descriptor.ruleId, input.rules)) descriptors.push(descriptor);
}

function inspectContainers(
  input: ScanKubernetesYamlInput,
  document: ParsedKubernetesDocument,
  podPath: KubernetesPathSegment[],
  descriptors: FindingDescriptor[]
): void {
  for (const collection of ["initContainers", "containers", "ephemeralContainers"] as const) {
    const containers = valueAt(document.value, [...podPath, collection]);
    if (!Array.isArray(containers)) continue;

    for (let index = 0; index < containers.length; index += 1) {
      if (!asRecord(containers[index])) continue;
      const securityPath: KubernetesPathSegment[] = [
        ...podPath,
        collection,
        index,
        "securityContext"
      ];

      const privilegedPath = [...securityPath, "privileged"];
      if (booleanAt(document.value, privilegedPath) === true) {
        addDescriptor(descriptors, input, {
          ruleId: "iac/kubernetes-privileged-container",
          document,
          path: privilegedPath,
          structuralContext: "Kubernetes container privileged mode",
          evidenceSummary: "Observed a Kubernetes container with privileged mode explicitly enabled."
        });
      }

      const escalationPath = [...securityPath, "allowPrivilegeEscalation"];
      if (booleanAt(document.value, escalationPath) === true) {
        addDescriptor(descriptors, input, {
          ruleId: "iac/kubernetes-privilege-escalation",
          document,
          path: escalationPath,
          structuralContext: "Kubernetes container privilege escalation",
          evidenceSummary: "Observed a Kubernetes container with privilege escalation explicitly enabled."
        });
      }

      const capabilityPath = [...securityPath, "capabilities", "add"];
      const capabilities = stringArrayAt(document.value, capabilityPath);
      if (capabilities.some((capability) => HIGH_RISK_CAPABILITIES.has(capability.toUpperCase()))) {
        addDescriptor(descriptors, input, {
          ruleId: "iac/kubernetes-broad-capabilities",
          document,
          path: capabilityPath,
          structuralContext: "Kubernetes container Linux capabilities",
          evidenceSummary: "Observed a Kubernetes container that explicitly adds a broad or high-risk Linux capability."
        });
      }

      const rootFilesystemPath = [...securityPath, "readOnlyRootFilesystem"];
      if (booleanAt(document.value, rootFilesystemPath) === false) {
        addDescriptor(descriptors, input, {
          ruleId: "iac/kubernetes-writable-root-filesystem",
          document,
          path: rootFilesystemPath,
          structuralContext: "Kubernetes container root filesystem",
          evidenceSummary: "Observed a Kubernetes container with read-only root filesystem hardening explicitly disabled."
        });
      }

      const runAsUserPath = [...securityPath, "runAsUser"];
      if (numberAt(document.value, runAsUserPath) === 0) {
        addDescriptor(descriptors, input, {
          ruleId: "iac/kubernetes-root-user",
          document,
          path: runAsUserPath,
          structuralContext: "Kubernetes container runtime user",
          evidenceSummary: "Observed a Kubernetes container explicitly configured to run as UID 0."
        });
      }
    }
  }
}

function inspectPodSpec(
  input: ScanKubernetesYamlInput,
  document: ParsedKubernetesDocument,
  podPath: KubernetesPathSegment[],
  descriptors: FindingDescriptor[]
): void {
  const namespaceRules: Array<{
    field: "hostNetwork" | "hostPID" | "hostIPC";
    ruleId: string;
    context: string;
    evidence: string;
  }> = [
    {
      field: "hostNetwork",
      ruleId: "iac/kubernetes-host-network",
      context: "Kubernetes pod host network namespace",
      evidence: "Observed a Kubernetes pod with host network access explicitly enabled."
    },
    {
      field: "hostPID",
      ruleId: "iac/kubernetes-host-pid",
      context: "Kubernetes pod host PID namespace",
      evidence: "Observed a Kubernetes pod with host PID namespace access explicitly enabled."
    },
    {
      field: "hostIPC",
      ruleId: "iac/kubernetes-host-ipc",
      context: "Kubernetes pod host IPC namespace",
      evidence: "Observed a Kubernetes pod with host IPC namespace access explicitly enabled."
    }
  ];

  for (const namespaceRule of namespaceRules) {
    const path = [...podPath, namespaceRule.field];
    if (booleanAt(document.value, path) !== true) continue;
    addDescriptor(descriptors, input, {
      ruleId: namespaceRule.ruleId,
      document,
      path,
      structuralContext: namespaceRule.context,
      evidenceSummary: namespaceRule.evidence
    });
  }

  const tokenPath = [...podPath, "automountServiceAccountToken"];
  if (booleanAt(document.value, tokenPath) === true) {
    addDescriptor(descriptors, input, {
      ruleId: "iac/kubernetes-service-account-token",
      document,
      path: tokenPath,
      structuralContext: "Kubernetes pod service account token automount",
      evidenceSummary: "Observed a Kubernetes pod with automatic service account token mounting explicitly enabled."
    });
  }

  const podRunAsUserPath = [...podPath, "securityContext", "runAsUser"];
  if (numberAt(document.value, podRunAsUserPath) === 0) {
    addDescriptor(descriptors, input, {
      ruleId: "iac/kubernetes-root-user",
      document,
      path: podRunAsUserPath,
      structuralContext: "Kubernetes pod runtime user",
      evidenceSummary: "Observed a Kubernetes pod explicitly configured to run as UID 0."
    });
  }

  const volumes = valueAt(document.value, [...podPath, "volumes"]);
  if (Array.isArray(volumes)) {
    for (let index = 0; index < volumes.length; index += 1) {
      const hostPath = [...podPath, "volumes", index, "hostPath"];
      if (asRecord(valueAt(document.value, hostPath))) {
        addDescriptor(descriptors, input, {
          ruleId: "iac/kubernetes-host-path",
          document,
          path: hostPath,
          structuralContext: "Kubernetes pod hostPath volume",
          evidenceSummary: "Observed a Kubernetes pod volume backed by a host filesystem path."
        });
      }
    }
  }

  inspectContainers(input, document, podPath, descriptors);
}

function inspectRbac(
  input: ScanKubernetesYamlInput,
  document: ParsedKubernetesDocument,
  descriptors: FindingDescriptor[]
): void {
  if (document.kind !== "Role" && document.kind !== "ClusterRole") return;
  const rules = valueAt(document.value, ["rules"]);
  if (!Array.isArray(rules)) return;

  for (let index = 0; index < rules.length; index += 1) {
    const verbsPath: KubernetesPathSegment[] = ["rules", index, "verbs"];
    const resourcesPath: KubernetesPathSegment[] = ["rules", index, "resources"];
    const verbs = stringArrayAt(document.value, verbsPath);
    const resources = stringArrayAt(document.value, resourcesPath);
    if (!verbs.includes("*") || !resources.includes("*")) continue;

    addDescriptor(descriptors, input, {
      ruleId: "iac/kubernetes-wildcard-rbac",
      document,
      path: verbsPath,
      structuralContext: "Kubernetes RBAC wildcard grant",
      evidenceSummary: "Observed a Kubernetes RBAC rule that combines wildcard verbs with wildcard resources."
    });
  }
}

export function scanKubernetesYaml(input: ScanKubernetesYamlInput): KubernetesScanResult {
  const parsed = parseKubernetesYaml(
    { file: input.file, content: input.content },
    input.parser ?? {}
  );
  if (parsed.errors.length > 0) return { findings: [], errors: parsed.errors };

  const descriptors: FindingDescriptor[] = [];
  for (const document of parsed.documents) {
    const podPath = podSpecPath(document.kind);
    if (podPath) inspectPodSpec(input, document, podPath, descriptors);
    inspectRbac(input, document, descriptors);
  }

  const findings = descriptors
    .map((descriptor) => createKubernetesFinding(descriptor, input.file))
    .filter((finding): finding is Finding => finding !== null)
    .sort(compareFindings);

  return { findings, errors: [] };
}
