import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("CI artifact action runtime", () => {
  it("uses an immutable upload-artifact v7 pin for the visual acceptance artifact", async () => {
    const workflow = await readFile(
      path.join(root, ".github/workflows/ci.yml"),
      "utf8",
    );

    expect(workflow).toMatch(
      /uses:\s*actions\/upload-artifact@[0-9a-f]{40}\s+#\s+v7(?:\s|$)/,
    );
    expect(workflow).not.toMatch(/uses:\s*actions\/upload-artifact@v\d+/);
    expect(workflow).not.toMatch(/actions\/upload-artifact@[0-9a-f]{40}\s+#\s+v4(?:\s|$)/);
  });
});
