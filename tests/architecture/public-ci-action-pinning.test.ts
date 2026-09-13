import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const immutablePin = (action: string, major: number) =>
  new RegExp(
    `uses:\\s*${action.replace("/", "\\/")}@[0-9a-f]{40}\\s+#\\s+v${major}(?:\\s|$)`,
  );

describe("published CI action supply-chain pins", () => {
  it("uses immutable first-party action commits in the public ScopeForge workflow example", async () => {
    const ciGuide = await readFile(
      path.join(root, "docs/scanner/CI.md"),
      "utf8",
    );

    expect(ciGuide).toMatch(immutablePin("actions/checkout", 7));
    expect(ciGuide).toMatch(immutablePin("actions/setup-node", 7));
    expect(ciGuide).toMatch(
      immutablePin("github/codeql-action/upload-sarif", 4),
    );
    expect(ciGuide).not.toMatch(
      /uses:\s*(?:actions\/(?:checkout|setup-node)|github\/codeql-action\/upload-sarif)@v\d+/,
    );
  });
});
