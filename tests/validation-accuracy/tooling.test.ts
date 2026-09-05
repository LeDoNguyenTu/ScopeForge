import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("validation corpus tooling isolation", () => {
  it("keeps committed target repositories outside the ScopeForge application TypeScript project", () => {
    const tsconfig = JSON.parse(
      readFileSync(join(process.cwd(), "tsconfig.json"), "utf8"),
    ) as { exclude?: string[] };

    expect(tsconfig.exclude).toContain("validation/corpus");
  });
});
