import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(".github/workflows/ci.yml", "utf8");

const pinnedAction = (name: string, major: number) =>
  new RegExp(`uses:\\s*${name.replace("/", "\\/")}@[0-9a-f]{40}\\s+#\\s+v${major}(?:\\s|$)`);

describe("CI action supply-chain pins", () => {
  it("pins first-party actions to immutable commits while retaining readable major-version comments", () => {
    expect(workflow).toMatch(pinnedAction("actions/checkout", 7));
    expect(workflow).toMatch(pinnedAction("actions/setup-node", 7));
    expect(workflow).toMatch(pinnedAction("actions/upload-artifact", 7));
    expect(workflow).not.toMatch(/uses:\s*actions\/(?:checkout|setup-node|upload-artifact)@v\d+/);
  });
});
