import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Phase 6C scanner container entrypoint", () => {
  it("emits the privacy-reduced result to stdout without a writable result path", async () => {
    const source = await readFile(
      path.resolve("packages/hosted-scanner-runner/container-entry.ts"),
      "utf8",
    );

    expect(source).toContain("process.stdout.write");
    expect(source).not.toContain("writeFile");
    expect(source).not.toContain("/result");
    expect(source).not.toContain("result.json");
  });
});