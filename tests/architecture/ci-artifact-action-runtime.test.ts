import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("CI artifact action runtime", () => {
  it("uses upload-artifact v7 for the visual acceptance artifact", async () => {
    const workflow = await readFile(
      path.join(root, ".github/workflows/ci.yml"),
      "utf8",
    );

    expect(workflow).toContain("uses: actions/upload-artifact@v7");
    expect(workflow).not.toContain("uses: actions/upload-artifact@v4");
  });
});
