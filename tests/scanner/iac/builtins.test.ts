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

describe("IaC built-in registration", () => {
  it("lists all Docker rules and registers the IaC scanner", async () => {
    const root = await mkdtemp(join(tmpdir(), "scopeforge-iac-builtins-"));
    tempPaths.push(root);
    const config = await loadScannerConfig(root);
    const ruleList = formatBuiltInRuleList();

    expect(ruleList).toContain("iac/docker-floating-base-image\t1.0.0\tFloating Docker base image");
    expect(ruleList).toContain("iac/docker-root-user\t1.0.0\tFinal Docker stage explicitly runs as root");
    expect(ruleList).toContain("iac/docker-remote-add\t1.0.0\tRemote source used by Docker ADD");
    expect(ruleList).toContain("iac/docker-download-pipe-shell\t1.0.0\tDownloaded content piped directly to a shell");
    expect(ruleList).toContain("iac/docker-world-writable-permissions\t1.0.0\tWorld-writable Docker filesystem permissions");
    expect(createBuiltInScanners(config).map((scanner) => scanner.name)).toEqual([
      "secrets",
      "jsts",
      "sca",
      "iac"
    ]);
  });
});
