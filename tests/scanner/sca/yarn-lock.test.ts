import { describe, expect, it } from "vitest";

import { parseYarnLock } from "@/packages/scanner-sca/lockfiles/yarn-lock";

describe("parseYarnLock", () => {
  it("parses classic and Berry selector entries without evaluating lockfile content", () => {
    const content = [
      "# yarn lockfile v1",
      'lodash@^4.17.0, lodash@~4.17.20:',
      '  version "4.17.21"',
      '"@scope/pkg@^1.0.0":',
      '  version "1.2.3"',
      'react@npm:^19.0.0:',
      '  version: 19.1.0',
      'metadata:',
      '  version: 8',
      '  cacheKey: fake@9.9.9'
    ].join("\n");

    const result = parseYarnLock({ file: "yarn.lock", content });

    expect(result.errors).toEqual([]);
    expect(result.components.map(({ name, version, purl }) => ({ name, version, purl }))).toEqual([
      { name: "@scope/pkg", version: "1.2.3", purl: "pkg:npm/%40scope/pkg@1.2.3" },
      { name: "lodash", version: "4.17.21", purl: "pkg:npm/lodash@4.17.21" },
      { name: "react", version: "19.1.0", purl: "pkg:npm/react@19.1.0" }
    ]);
  });

  it("deduplicates selectors resolving to the same package version", () => {
    const result = parseYarnLock({
      file: "yarn.lock",
      content: [
        'lodash@^4.17.0:',
        '  version "4.17.21"',
        'lodash@~4.17.20:',
        '  version "4.17.21"'
      ].join("\n")
    });

    expect(result.errors).toEqual([]);
    expect(result.components).toHaveLength(1);
    expect(result.components[0]).toMatchObject({ name: "lodash", version: "4.17.21" });
  });

  it("fails closed on an oversized hostile line", () => {
    const result = parseYarnLock({
      file: "yarn.lock",
      content: `lodash@^4.17.0:${"x".repeat(70_000)}`
    });

    expect(result.components).toEqual([]);
    expect(result.errors[0]?.code).toBe("invalid_lockfile");
  });
});
