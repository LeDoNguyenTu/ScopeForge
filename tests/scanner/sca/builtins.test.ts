import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createBuiltInScanners, formatBuiltInRuleList } from "@/packages/cli/builtins";
import { loadScannerConfig } from "@/packages/scanner-core/config/load-config";

const tempPaths: string[] = [];

afterEach(async () => {
  await Promise.all(tempPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("SCA built-in registration", () => {
  it("lists the known-vulnerability rule and registers the SCA scanner", async () => {
    const root = await mkdtemp(join(tmpdir(), "scopeforge-sca-builtins-"));
    tempPaths.push(root);
    const config = await loadScannerConfig(root);

    expect(formatBuiltInRuleList()).toContain("sca/known-vulnerability\t1.0.0\tKnown vulnerable dependency");
    expect(createBuiltInScanners(config).map((scanner) => scanner.name)).toEqual(["secrets", "jsts", "sca"]);
  });
});
