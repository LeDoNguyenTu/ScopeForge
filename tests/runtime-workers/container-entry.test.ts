import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const entryPath = path.resolve("packages/runtime-worker-runner/container-entry.ts");

describe("Phase 6D runtime worker container entry", () => {
  it("performs only one fixed Unix mediator call and writes the closed response", async () => {
    const source = await readFile(entryPath, "utf8");
    expect(source).toContain("runRuntimeMediatorUnixRequest");
    expect(source).toContain("process.stdout.write");
    expect(source).not.toContain("console.");
    expect(source).not.toContain("canonicalUrl");
    expect(source).not.toContain("hostname");
    expect(source).not.toContain("assetRef");
    expect(source).not.toContain("leaseToken");
    expect(source).not.toContain("service_role");

    for (const forbidden of [
      "node:http",
      "node:https",
      "node:tls",
      "node:dns",
      "packages/runtime-network",
      "requestPinnedHttps",
      "fetch(",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
