import { describe, expect, it } from "vitest";

import { scanSecretText } from "@/packages/scanner-secrets/scan-file";

const githubToken = "ghp_" + "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8";
const stripeKey = "sk_live_" + "A1b2C3d4E5f6G7h8I9j0K1l2";
const slackToken = "xoxb-" + "123456789012-123456789012-A1b2C3d4E5f6G7h8I9j0K1l2";

describe("provider secret rules", () => {
  it("detects a small high-confidence provider set and private-key headers", () => {
    const privateHeader = "-----BEGIN " + "PRIVATE KEY-----";
    const content = [
      `const github = "${githubToken}";`,
      `const stripe = "${stripeKey}";`,
      `const slack = "${slackToken}";`,
      privateHeader,
      "SYNTHETIC_TEST_MATERIAL_NOT_A_REAL_KEY",
      "-----END PRIVATE KEY-----"
    ].join("\n");

    const findings = scanSecretText({ file: "src/secrets.ts", content });

    expect(findings.map((finding) => finding.ruleId)).toEqual([
      "secrets/github-token",
      "secrets/stripe-live-key",
      "secrets/slack-token",
      "secrets/private-key"
    ]);
    const serialized = JSON.stringify(findings);
    expect(serialized).not.toContain(githubToken);
    expect(serialized).not.toContain(stripeKey);
    expect(serialized).not.toContain(slackToken);
    expect(serialized).not.toContain("SYNTHETIC_TEST_MATERIAL_NOT_A_REAL_KEY");
  });

  it("suppresses obvious placeholders and test-mode keys", () => {
    const content = [
      'const github = "ghp_' + 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";',
      'const stripe = "sk_test_' + 'A1b2C3d4E5f6G7h8I9j0K1l2";',
      'const docs = "github_pat_' + 'EXAMPLE_PLACEHOLDER_NOT_A_REAL_CREDENTIAL";'
    ].join("\n");

    expect(scanSecretText({ file: "docs/example.ts", content })).toEqual([]);
  });

  it("supports an exact safe-fixture annotation on the same or previous line", () => {
    const content = [
      "// scopeforge:allow-secret",
      `const first = "${githubToken}";`,
      `const second = "${stripeKey}"; // scopeforge:allow-secret`,
      `const unsuppressed = "${slackToken}";`
    ].join("\n");

    const findings = scanSecretText({ file: "tests/fixture.ts", content });
    expect(findings.map((finding) => finding.ruleId)).toEqual(["secrets/slack-token"]);
  });
});
