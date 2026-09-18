import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Vercel deployment budget policy", () => {
  it("deploys only main and explicit vercel-preview branches", async () => {
    const raw = await readFile(path.resolve(process.cwd(), "vercel.json"), "utf8");
    const config = JSON.parse(raw) as {
      git?: { deploymentEnabled?: Record<string, boolean> };
    };

    expect(config.git?.deploymentEnabled).toEqual({
      "**": false,
      main: true,
      "vercel-preview-*": true,
    });
  });
});
