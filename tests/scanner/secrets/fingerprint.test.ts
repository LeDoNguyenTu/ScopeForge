import { describe, expect, it } from "vitest";

import { createSecretFingerprint } from "@/packages/scanner-secrets/findings/fingerprint";

const secret = "ghp_" + "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8";

describe("createSecretFingerprint", () => {
  it("is deterministic and never contains the raw secret", () => {
    const input = {
      ruleId: "secrets/github-token",
      file: "src/config.ts",
      structuralContext: "token = <secret>",
      secret
    };

    const first = createSecretFingerprint(input);
    const second = createSecretFingerprint({ ...input });

    expect(first).toMatch(/^sfs1:[a-f0-9]{64}$/);
    expect(second).toBe(first);
    expect(first).not.toContain(secret);
  });

  it("normalizes paths and rule casing", () => {
    const unix = createSecretFingerprint({
      ruleId: "SECRETS/GITHUB-TOKEN",
      file: "src/config.ts",
      structuralContext: "token = <secret>",
      secret
    });
    const windows = createSecretFingerprint({
      ruleId: "secrets/github-token",
      file: "src\\config.ts",
      structuralContext: " token = <secret> ",
      secret
    });

    expect(windows).toBe(unix);
  });

  it("changes when the secret changes without using line numbers", () => {
    const base = {
      ruleId: "secrets/github-token",
      file: "src/config.ts",
      structuralContext: "token = <secret>"
    };

    expect(createSecretFingerprint({ ...base, secret })).not.toBe(
      createSecretFingerprint({ ...base, secret: `${secret}X` })
    );
  });
});
