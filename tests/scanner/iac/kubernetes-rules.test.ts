import { describe, expect, it } from "vitest";

import { scanKubernetesYaml } from "@/packages/scanner-iac/kubernetes/scan";

function ruleIds(content: string): string[] {
  const result = scanKubernetesYaml({ file: "k8s.yaml", content });
  expect(result.errors).toEqual([]);
  return result.findings.map((finding) => finding.ruleId).sort();
}

describe("Kubernetes IaC rules", () => {
  it("flags privileged containers, explicit privilege escalation, and broad capabilities", () => {
    const result = scanKubernetesYaml({
      file: "deployment.yaml",
      content: [
        "apiVersion: apps/v1",
        "kind: Deployment",
        "metadata:",
        "  name: api",
        "spec:",
        "  template:",
        "    spec:",
        "      containers:",
        "        - name: app",
        "          image: example.invalid/app:1",
        "          securityContext:",
        "            privileged: true",
        "            allowPrivilegeEscalation: true",
        "            capabilities:",
        "              add: [ALL]"
      ].join("\n")
    });

    expect(result.errors).toEqual([]);
    expect(result.findings.map((finding) => [finding.ruleId, finding.location.startLine])).toEqual([
      ["iac/kubernetes-privileged-container", 12],
      ["iac/kubernetes-privilege-escalation", 13],
      ["iac/kubernetes-broad-capabilities", 15]
    ]);
  });

  it("flags host namespace exposure and hostPath mounts while accepting isolated pod settings", () => {
    expect(
      ruleIds([
        "apiVersion: v1",
        "kind: Pod",
        "metadata:",
        "  name: host-access",
        "spec:",
        "  hostNetwork: true",
        "  hostPID: true",
        "  hostIPC: true",
        "  volumes:",
        "    - name: host",
        "      hostPath:",
        "        path: /var/run",
        "  containers:",
        "    - name: app",
        "      image: example.invalid/app:1"
      ].join("\n"))
    ).toEqual([
      "iac/kubernetes-host-ipc",
      "iac/kubernetes-host-network",
      "iac/kubernetes-host-path",
      "iac/kubernetes-host-pid"
    ]);

    expect(
      ruleIds([
        "apiVersion: v1",
        "kind: Pod",
        "metadata:",
        "  name: isolated",
        "spec:",
        "  hostNetwork: false",
        "  hostPID: false",
        "  hostIPC: false",
        "  volumes:",
        "    - name: data",
        "      emptyDir: {}",
        "  containers:",
        "    - name: app",
        "      image: example.invalid/app:1"
      ].join("\n"))
    ).toEqual([]);
  });

  it("flags explicit root execution, writable root filesystems, and service-account token automounting", () => {
    expect(
      ruleIds([
        "apiVersion: batch/v1",
        "kind: CronJob",
        "metadata:",
        "  name: worker",
        "spec:",
        "  jobTemplate:",
        "    spec:",
        "      template:",
        "        spec:",
        "          automountServiceAccountToken: true",
        "          securityContext:",
        "            runAsUser: 0",
        "          containers:",
        "            - name: worker",
        "              image: example.invalid/worker:1",
        "              securityContext:",
        "                readOnlyRootFilesystem: false",
        "          restartPolicy: Never"
      ].join("\n"))
    ).toEqual([
      "iac/kubernetes-root-user",
      "iac/kubernetes-service-account-token",
      "iac/kubernetes-writable-root-filesystem"
    ]);
  });

  it("flags wildcard RBAC only when local rules grant broad wildcard permissions", () => {
    expect(
      ruleIds([
        "apiVersion: rbac.authorization.k8s.io/v1",
        "kind: ClusterRole",
        "metadata:",
        "  name: dangerous",
        "rules:",
        "  - apiGroups: ['*']",
        "    resources: ['*']",
        "    verbs: ['*']"
      ].join("\n"))
    ).toEqual(["iac/kubernetes-wildcard-rbac"]);

    expect(
      ruleIds([
        "apiVersion: rbac.authorization.k8s.io/v1",
        "kind: Role",
        "metadata:",
        "  name: reader",
        "rules:",
        "  - apiGroups: ['']",
        "    resources: ['pods']",
        "    verbs: ['get', 'list']"
      ].join("\n"))
    ).toEqual([]);
  });

  it("scans init containers and does not infer missing hardening fields as vulnerabilities", () => {
    expect(
      ruleIds([
        "apiVersion: v1",
        "kind: Pod",
        "metadata:",
        "  name: init-example",
        "spec:",
        "  initContainers:",
        "    - name: init",
        "      image: example.invalid/init:1",
        "      securityContext:",
        "        privileged: true",
        "  containers:",
        "    - name: app",
        "      image: example.invalid/app:1"
      ].join("\n"))
    ).toEqual(["iac/kubernetes-privileged-container"]);

    expect(
      ruleIds([
        "apiVersion: apps/v1",
        "kind: Deployment",
        "metadata:",
        "  name: unspecified",
        "spec:",
        "  template:",
        "    spec:",
        "      containers:",
        "        - name: app",
        "          image: example.invalid/app:1"
      ].join("\n"))
    ).toEqual([]);
  });
});
