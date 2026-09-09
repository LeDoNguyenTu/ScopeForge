import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  loadSecurityPackManifest,
  validateSecurityPackFixtures,
} from "@/packages/security-packs";

const firstPartyPackRoot = resolve("security-packs/first-party/node-tls-verification");

describe("first-party Security Pack", () => {
  it("validates the first-party node TLS example through the public API", async () => {
    const pack = await loadSecurityPackManifest(firstPartyPackRoot);
    const report = await validateSecurityPackFixtures(pack);

    expect(report).toMatchObject({
      packId: "org.scopeforge.node-tls",
      packVersion: "1.0.0",
      rules: 1,
      cases: 3,
      findings: 1,
      valid: true,
    });
  });
});
