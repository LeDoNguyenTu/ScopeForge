import { describe, expect, it } from "vitest";

import { scanGitHubActionsYaml } from "@/packages/scanner-iac/github-actions/scan";

function ruleIds(content: string): string[] {
  return scanGitHubActionsYaml({
    file: ".github/workflows/ci.yml",
    content
  }).findings.map((finding) => finding.ruleId);
}

describe("GitHub Actions IaC rules", () => {
  it("flags direct untrusted GitHub context interpolation into run but not env indirection", () => {
    const unsafe = [
      "name: Unsafe",
      "on: pull_request",
      "jobs:",
      "  check:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - run: echo \"${{ github.event.pull_request.title }}\""
    ].join("\n");
    expect(ruleIds(unsafe)).toEqual(["iac/github-actions-untrusted-shell-interpolation"]);

    const safe = [
      "name: Safer",
      "on: pull_request",
      "jobs:",
      "  check:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - env:",
      "          TITLE: ${{ github.event.pull_request.title }}",
      "        run: printf '%s\\n' \"$TITLE\""
    ].join("\n");
    expect(ruleIds(safe)).toEqual([]);
  });

  it("flags write-all token permissions", () => {
    const content = [
      "name: Privileged",
      "on: workflow_dispatch",
      "permissions: write-all",
      "jobs:",
      "  release:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - run: echo release"
    ].join("\n");

    expect(ruleIds(content)).toEqual(["iac/github-actions-write-all-permissions"]);
  });

  it("flags mutable external action references but accepts immutable and local references", () => {
    const content = [
      "name: Supply chain",
      "on: push",
      "jobs:",
      "  build:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - uses: vendor/example-action@v2",
      "      - uses: vendor/pinned-action@0123456789abcdef0123456789abcdef01234567",
      "      - uses: actions/checkout@v7",
      "      - uses: ./local-action"
    ].join("\n");

    expect(ruleIds(content)).toEqual(["iac/github-actions-unpinned-third-party-action"]);
  });

  it("flags pull_request_target checkout-and-execute chains while respecting checkout v7 protection", () => {
    const vulnerableV6 = [
      "name: PR target",
      "on: pull_request_target",
      "jobs:",
      "  test:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - uses: actions/checkout@v6",
      "        with:",
      "          ref: ${{ github.event.pull_request.head.sha }}",
      "      - run: npm test"
    ].join("\n");
    expect(ruleIds(vulnerableV6)).toEqual(["iac/github-actions-pull-request-target-code-execution"]);

    const protectedV7 = vulnerableV6.replace("actions/checkout@v6", "actions/checkout@v7");
    expect(ruleIds(protectedV7)).toEqual([]);

    const optedOutV7 = protectedV7.replace(
      "          ref: ${{ github.event.pull_request.head.sha }}",
      "          ref: ${{ github.event.pull_request.head.sha }}\n          allow-unsafe-pr-checkout: true"
    );
    expect(ruleIds(optedOutV7)).toEqual(["iac/github-actions-pull-request-target-code-execution"]);
  });

  it("flags self-hosted pull-request jobs that check out and execute pull-request code", () => {
    const content = [
      "name: Self hosted PR",
      "on: pull_request",
      "jobs:",
      "  test:",
      "    runs-on: [self-hosted, linux]",
      "    steps:",
      "      - uses: actions/checkout@v7",
      "      - run: npm test"
    ].join("\n");

    expect(ruleIds(content)).toEqual(["iac/github-actions-self-hosted-pr-code-execution"]);
  });

  it("flags broad write credentials persisted across later executable steps", () => {
    const content = [
      "name: Persistent token",
      "on: workflow_dispatch",
      "permissions: write-all",
      "jobs:",
      "  release:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - uses: actions/checkout@v7",
      "      - run: ./release.sh"
    ].join("\n");

    expect(ruleIds(content)).toEqual([
      "iac/github-actions-write-all-permissions",
      "iac/github-actions-persisted-write-credentials"
    ]);

    const hardened = content.replace(
      "      - uses: actions/checkout@v7",
      "      - uses: actions/checkout@v7\n        with:\n          persist-credentials: false"
    );
    expect(ruleIds(hardened)).toEqual(["iac/github-actions-write-all-permissions"]);
  });
});
