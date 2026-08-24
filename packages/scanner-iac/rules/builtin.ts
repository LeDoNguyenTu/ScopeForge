import type { IacRuleDefinition } from "./types";

export const IAC_RULES: readonly IacRuleDefinition[] = [
  {
    id: "iac/docker-download-pipe-shell",
    version: "1.0.0",
    title: "Downloaded content piped directly to a shell",
    description: "A Docker RUN instruction pipes curl or wget output directly into sh or bash.",
    severity: "high",
    confidence: "high",
    cwe: ["CWE-494"],
    owasp: ["A08:2021"],
    remediation: {
      summary: "Verify downloaded artifacts before execution.",
      guidance: "Download the artifact separately, pin an expected version, verify its integrity or signature, and only then execute trusted local content.",
      verification: "Rescan and confirm no Docker RUN instruction pipes network download output directly into a shell."
    }
  },
  {
    id: "iac/docker-floating-base-image",
    version: "1.0.0",
    title: "Floating Docker base image",
    description: "A Docker build stage uses an untagged or latest-tagged base image instead of an immutable or explicit version reference.",
    severity: "medium",
    confidence: "high",
    cwe: ["CWE-1104"],
    owasp: ["A06:2021"],
    remediation: {
      summary: "Pin Docker base images to an explicit maintained version or digest.",
      guidance: "Use a reviewed version tag and, for reproducible supply-chain control, prefer a digest pin that is updated through a controlled dependency process.",
      verification: "Rescan and confirm every static base image reference is explicitly versioned or digest-pinned."
    }
  },
  {
    id: "iac/docker-remote-add",
    version: "1.0.0",
    title: "Remote source used by Docker ADD",
    description: "A Docker ADD instruction retrieves content from a remote URL or source-control location during the image build.",
    severity: "medium",
    confidence: "high",
    cwe: ["CWE-494"],
    owasp: ["A08:2021"],
    remediation: {
      summary: "Fetch and verify remote build inputs explicitly.",
      guidance: "Retrieve remote artifacts in a controlled step, pin their identity, verify integrity or signatures, then COPY the verified local artifact into the image.",
      verification: "Rescan and confirm Docker ADD no longer consumes remote sources."
    }
  },
  {
    id: "iac/docker-root-user",
    version: "1.0.0",
    title: "Final Docker stage explicitly runs as root",
    description: "The final Docker build stage explicitly leaves root as its effective USER.",
    severity: "medium",
    confidence: "high",
    cwe: ["CWE-250"],
    owasp: ["A05:2021"],
    remediation: {
      summary: "Run the final container as a dedicated non-root user.",
      guidance: "Create or select the least-privileged account required by the application and make it the final explicit USER after privileged build steps are complete.",
      verification: "Rescan and confirm the final stage's effective explicit USER is non-root."
    }
  },
  {
    id: "iac/docker-world-writable-permissions",
    version: "1.0.0",
    title: "World-writable Docker filesystem permissions",
    description: "A Docker RUN instruction applies mode 777 or 0777, granting write access to every user.",
    severity: "medium",
    confidence: "high",
    cwe: ["CWE-732"],
    owasp: ["A05:2021"],
    remediation: {
      summary: "Use the narrowest filesystem permissions the application requires.",
      guidance: "Replace world-writable modes with owner/group permissions and ownership appropriate to the runtime account.",
      verification: "Rescan and confirm no Docker RUN instruction applies mode 777 or 0777."
    }
  },
  {
    id: "iac/kubernetes-broad-capabilities",
    version: "1.0.0",
    title: "Broad Kubernetes Linux capabilities",
    description: "A Kubernetes container explicitly adds ALL or another high-risk Linux capability.",
    severity: "high",
    confidence: "high",
    cwe: ["CWE-250"],
    owasp: ["A05:2021"],
    remediation: {
      summary: "Drop unnecessary Linux capabilities.",
      guidance: "Avoid adding ALL or high-risk capabilities. Add only the smallest explicitly justified capability set required by the workload.",
      verification: "Rescan and confirm the container no longer adds broad or high-risk Linux capabilities."
    }
  },
  {
    id: "iac/kubernetes-host-ipc",
    version: "1.0.0",
    title: "Kubernetes host IPC namespace exposure",
    description: "A Kubernetes pod explicitly joins the host IPC namespace.",
    severity: "high",
    confidence: "high",
    cwe: ["CWE-668"],
    owasp: ["A05:2021"],
    remediation: {
      summary: "Keep workloads isolated from the host IPC namespace.",
      guidance: "Remove hostIPC unless the workload has a narrowly reviewed operational requirement for host IPC access.",
      verification: "Rescan and confirm hostIPC is not enabled."
    }
  },
  {
    id: "iac/kubernetes-host-network",
    version: "1.0.0",
    title: "Kubernetes host network exposure",
    description: "A Kubernetes pod explicitly joins the host network namespace.",
    severity: "medium",
    confidence: "high",
    cwe: ["CWE-668"],
    owasp: ["A05:2021"],
    remediation: {
      summary: "Keep workloads isolated from the host network namespace.",
      guidance: "Remove hostNetwork unless host networking is required and the affected nodes and ports are deliberately constrained.",
      verification: "Rescan and confirm hostNetwork is not enabled."
    }
  },
  {
    id: "iac/kubernetes-host-path",
    version: "1.0.0",
    title: "Kubernetes hostPath mount",
    description: "A Kubernetes pod mounts a path from the host filesystem.",
    severity: "high",
    confidence: "high",
    cwe: ["CWE-668"],
    owasp: ["A05:2021"],
    remediation: {
      summary: "Avoid direct host filesystem mounts.",
      guidance: "Replace hostPath with a workload-scoped volume where possible. If hostPath is unavoidable, constrain the path, permissions, workload identity, and node placement.",
      verification: "Rescan and confirm hostPath volumes are removed or explicitly reviewed."
    }
  },
  {
    id: "iac/kubernetes-host-pid",
    version: "1.0.0",
    title: "Kubernetes host PID namespace exposure",
    description: "A Kubernetes pod explicitly joins the host PID namespace.",
    severity: "high",
    confidence: "high",
    cwe: ["CWE-668"],
    owasp: ["A05:2021"],
    remediation: {
      summary: "Keep workloads isolated from the host PID namespace.",
      guidance: "Remove hostPID unless the workload has a narrowly reviewed operational requirement for host process visibility.",
      verification: "Rescan and confirm hostPID is not enabled."
    }
  },
  {
    id: "iac/kubernetes-privilege-escalation",
    version: "1.0.0",
    title: "Kubernetes privilege escalation allowed",
    description: "A Kubernetes container explicitly allows processes to gain additional privileges.",
    severity: "high",
    confidence: "high",
    cwe: ["CWE-250"],
    owasp: ["A05:2021"],
    remediation: {
      summary: "Disable container privilege escalation.",
      guidance: "Set securityContext.allowPrivilegeEscalation to false unless a narrowly reviewed workload requirement makes escalation unavoidable.",
      verification: "Rescan and confirm allowPrivilegeEscalation is not enabled."
    }
  },
  {
    id: "iac/kubernetes-privileged-container",
    version: "1.0.0",
    title: "Privileged Kubernetes container",
    description: "A Kubernetes container explicitly runs in privileged mode.",
    severity: "high",
    confidence: "high",
    cwe: ["CWE-250"],
    owasp: ["A05:2021"],
    remediation: {
      summary: "Run the container without privileged mode.",
      guidance: "Remove securityContext.privileged and grant only narrowly required capabilities or device access through reviewed alternatives.",
      verification: "Rescan and confirm privileged mode is not enabled."
    }
  },
  {
    id: "iac/kubernetes-root-user",
    version: "1.0.0",
    title: "Kubernetes workload explicitly runs as root",
    description: "A Kubernetes pod or container explicitly configures runAsUser as UID 0.",
    severity: "medium",
    confidence: "high",
    cwe: ["CWE-250"],
    owasp: ["A05:2021"],
    remediation: {
      summary: "Run the workload as a non-root user.",
      guidance: "Set runAsNonRoot where appropriate and configure a non-zero runAsUser compatible with the container image and application.",
      verification: "Rescan and confirm no workload security context explicitly selects UID 0."
    }
  },
  {
    id: "iac/kubernetes-service-account-token",
    version: "1.0.0",
    title: "Kubernetes service account token automount enabled",
    description: "A Kubernetes pod explicitly enables automatic service account token mounting.",
    severity: "medium",
    confidence: "high",
    cwe: ["CWE-522"],
    owasp: ["A05:2021"],
    remediation: {
      summary: "Disable unnecessary service account token automounting.",
      guidance: "Set automountServiceAccountToken to false for workloads that do not call the Kubernetes API, and use a least-privileged service account when API access is required.",
      verification: "Rescan and confirm automatic service account token mounting is not explicitly enabled where unnecessary."
    }
  },
  {
    id: "iac/kubernetes-wildcard-rbac",
    version: "1.0.0",
    title: "Broad wildcard Kubernetes RBAC",
    description: "A Kubernetes Role or ClusterRole grants wildcard verbs over wildcard resources.",
    severity: "high",
    confidence: "high",
    cwe: ["CWE-732"],
    owasp: ["A01:2021", "A05:2021"],
    remediation: {
      summary: "Replace wildcard RBAC grants with least-privileged permissions.",
      guidance: "Enumerate only the API groups, resources, resource names, and verbs required by the workload or operator.",
      verification: "Rescan and confirm RBAC rules no longer combine wildcard verbs with wildcard resources."
    }
  },
  {
    id: "iac/kubernetes-writable-root-filesystem",
    version: "1.0.0",
    title: "Kubernetes writable root filesystem",
    description: "A Kubernetes container explicitly disables read-only root filesystem hardening.",
    severity: "low",
    confidence: "high",
    cwe: ["CWE-732"],
    owasp: ["A05:2021"],
    remediation: {
      summary: "Use a read-only container root filesystem where supported.",
      guidance: "Set readOnlyRootFilesystem to true and provide explicit writable volumes only for paths that require runtime writes.",
      verification: "Rescan and confirm readOnlyRootFilesystem is not explicitly disabled."
    }
  }
] as const;

export const IAC_RULE_IDS = IAC_RULES.map((rule) => rule.id);
