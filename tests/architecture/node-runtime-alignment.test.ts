import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("Node runtime alignment", () => {
  it("keeps the declared runtime and CI on Node 24 LTS", async () => {
    const packageJson = JSON.parse(
      await readFile(path.join(root, "package.json"), "utf8"),
    ) as { engines?: { node?: string } };
    const workflow = await readFile(
      path.join(root, ".github/workflows/ci.yml"),
      "utf8",
    );

    expect(packageJson.engines?.node).toBe(">=24 <25");
    expect(workflow).toMatch(/node-version:\s*["']?24["']?/);
    expect(workflow).not.toMatch(/node-version:\s*["']?22["']?/);
  });

  it("keeps the published CI integration example on Node 24", async () => {
    const ciGuide = await readFile(
      path.join(root, "docs/scanner/CI.md"),
      "utf8",
    );

    expect(ciGuide).toMatch(/node-version:\s*["']?24["']?/);
    expect(ciGuide).not.toMatch(/node-version:\s*["']?22["']?/);
  });
});
