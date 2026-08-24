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
  }
] as const;

export const IAC_RULE_IDS = IAC_RULES.map((rule) => rule.id);
