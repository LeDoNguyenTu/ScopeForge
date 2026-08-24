import { describe, expect, it } from "vitest";

import { parseGitHubActionsYaml } from "@/packages/scanner-iac/github-actions/parse";

describe("parseGitHubActionsYaml", () => {
  it("parses one workflow structurally and preserves value locations", () => {
    const result = parseGitHubActionsYaml({
      file: ".github/workflows/ci.yml",
      content: [
        "name: CI",
        "on:",
        "  pull_request:",
        "permissions: write-all",
        "jobs:",
        "  build:",
        "    runs-on: ubuntu-latest",
        "    steps:",
        "      - run: echo hello"
      ].join("\n")
    });

    expect(result.errors).toEqual([]);
    expect(result.workflow).not.toBeNull();
    expect(result.workflow?.value).toMatchObject({
      name: "CI",
      on: { pull_request: null },
      permissions: "write-all"
    });
    expect(result.workflow?.location(["jobs", "build", "steps", 0, "run"])?.startLine).toBe(9);
  });

  it("fails closed on malformed YAML without copying repository content into diagnostics", () => {
    const sentinel = "GITHUB_ACTIONS_PARSE_SENTINEL_c7d2";
    const result = parseGitHubActionsYaml({
      file: ".github/workflows/broken.yml",
      content: `name: ${sentinel}\njobs: [\n`
    });

    expect(result.workflow).toBeNull();
    expect(result.errors).toEqual([
      {
        code: "invalid_github_actions_yaml",
        file: ".github/workflows/broken.yml",
        message: "GitHub Actions YAML contains syntax errors and was not analyzed."
      }
    ]);
    expect(JSON.stringify(result)).not.toContain(sentinel);
  });

  it("enforces the alias expansion budget", () => {
    const result = parseGitHubActionsYaml(
      {
        file: ".github/workflows/alias.yml",
        content: [
          "env: &shared",
          "  SAFE: yes",
          "jobs:",
          "  build:",
          "    runs-on: ubuntu-latest",
          "    env: *shared",
          "    steps:",
          "      - run: echo ok"
        ].join("\n")
      },
      { maxAliasCount: 0 }
    );

    expect(result.workflow).toBeNull();
    expect(result.errors).toEqual([
      {
        code: "github_actions_alias_budget_exceeded",
        file: ".github/workflows/alias.yml",
        message: "GitHub Actions YAML exceeded the configured alias expansion budget."
      }
    ]);
  });
});
