import { describe, expect, it } from "vitest";

import { redactDetectedSecret } from "@/packages/scanner-secrets/redaction/redact";

const githubToken = "ghp_" + "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8";
const stripeKey = "sk_live_" + "A1b2C3d4E5f6G7h8I9j0K1l2";
const slackToken = "xoxb-" + "123456789012-123456789012-A1b2C3d4E5f6G7h8I9j0K1l2";

describe("redactDetectedSecret", () => {
  it.each([
    ["github", githubToken, "ghp_"],
    ["stripe", stripeKey, "sk_live_"],
    ["slack", slackToken, "xoxb-"],
    ["generic", "mK9pQ2vL7xR4tY8uW5nC1aB6dF3hJ0sZ", ""]
  ])("never exposes the raw %s secret", (provider, value, publicPrefix) => {
    const redacted = redactDetectedSecret({ value, provider, publicPrefix });
    const serialized = JSON.stringify(redacted);

    expect(serialized).not.toContain(value);
    expect(redacted.length).toBe(value.length);
    expect(redacted.display).toContain("REDACTED");
    if (publicPrefix) expect(redacted.display).toContain(publicPrefix);
  });

  it("shows only a private-key type marker", () => {
    const header = "-----BEGIN " + "PRIVATE KEY-----";
    const value = `${header}\nSYNTHETIC_TEST_MATERIAL\n-----END PRIVATE KEY-----`;
    const redacted = redactDetectedSecret({ value, provider: "private-key", publicPrefix: header });

    expect(JSON.stringify(redacted)).not.toContain("SYNTHETIC_TEST_MATERIAL");
    expect(redacted.display).toContain("PRIVATE KEY");
    expect(redacted.display).toContain("REDACTED");
  });
});
