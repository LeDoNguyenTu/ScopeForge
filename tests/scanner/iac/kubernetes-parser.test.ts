import { describe, expect, it } from "vitest";

import { parseKubernetesYaml } from "@/packages/scanner-iac/kubernetes/parse";

describe("parseKubernetesYaml", () => {
  it("parses multi-document Kubernetes YAML and preserves line locations", () => {
    const result = parseKubernetesYaml({
      file: "k8s.yaml",
      content: [
        "apiVersion: v1",
        "kind: Pod",
        "metadata:",
        "  name: api",
        "spec:",
        "  hostNetwork: true",
        "---",
        "apiVersion: apps/v1",
        "kind: Deployment",
        "metadata:",
        "  name: worker",
        "spec:",
        "  template:",
        "    spec:",
        "      containers:",
        "        - name: app",
        "          securityContext:",
        "            privileged: true"
      ].join("\n")
    });

    expect(result.errors).toEqual([]);
    expect(result.documents).toHaveLength(2);
    expect(result.documents.map((document) => document.kind)).toEqual(["Pod", "Deployment"]);
    expect(result.documents[0]?.location(["spec", "hostNetwork"])).toEqual({
      startLine: 6,
      startColumn: 16,
      endLine: 6,
      endColumn: 20
    });
    expect(result.documents[1]?.location([
      "spec",
      "template",
      "spec",
      "containers",
      0,
      "securityContext",
      "privileged"
    ])).toEqual({
      startLine: 18,
      startColumn: 25,
      endLine: 18,
      endColumn: 29
    });
  });

  it("fails closed on malformed YAML without copying repository content into diagnostics", () => {
    const sentinel = "KUBERNETES_PARSE_SENTINEL_81a7";
    const result = parseKubernetesYaml({
      file: "broken.yaml",
      content: `apiVersion: v1\nkind: Pod\nmetadata: [${sentinel}\n`
    });

    expect(result.documents).toEqual([]);
    expect(result.errors).toEqual([
      {
        code: "invalid_kubernetes_yaml",
        file: "broken.yaml",
        message: "Kubernetes YAML contains syntax errors and was not analyzed."
      }
    ]);
    expect(JSON.stringify(result)).not.toContain(sentinel);
  });

  it("enforces document and alias budgets", () => {
    const tooMany = parseKubernetesYaml(
      {
        file: "many.yaml",
        content: "apiVersion: v1\nkind: Pod\n---\napiVersion: v1\nkind: Service\n"
      },
      { maxDocuments: 1 }
    );
    expect(tooMany.documents).toEqual([]);
    expect(tooMany.errors).toEqual([
      {
        code: "kubernetes_document_budget_exceeded",
        file: "many.yaml",
        message: "Kubernetes YAML exceeded the configured document budget."
      }
    ]);

    const aliased = parseKubernetesYaml(
      {
        file: "alias.yaml",
        content: "apiVersion: v1\nkind: Pod\nmetadata: &meta\n  name: api\nlabels: *meta\n"
      },
      { maxAliasCount: 0 }
    );
    expect(aliased.documents).toEqual([]);
    expect(aliased.errors).toEqual([
      {
        code: "kubernetes_alias_budget_exceeded",
        file: "alias.yaml",
        message: "Kubernetes YAML exceeded the configured alias expansion budget."
      }
    ]);
  });
});
