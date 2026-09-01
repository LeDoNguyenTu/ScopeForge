import { describe, expect, it } from "vitest";

import {
  compileSecurityPackPathPattern,
} from "@/packages/security-packs";

describe("Security Pack path patterns", () => {
  it.each([
    ["Dockerfile*", "Dockerfile.prod", true],
    ["src/?pp.ts", "src/app.ts", true],
    ["**/Dockerfile*", "Dockerfile", true],
    ["**/Dockerfile*", "services/api/Dockerfile.dev", true],
    ["**/test-fixtures/**", "test-fixtures/Dockerfile", true],
    ["**/test-fixtures/**", "src/Dockerfile", false],
  ])("matches %s against %s", (pattern, path, expected) => {
    expect(compileSecurityPackPathPattern(pattern).matches(path)).toBe(expected);
  });

  it.each([
    ["src/?pp.ts", "src/pp.ts", false],
    ["src/?pp.ts", "src/xapp.ts", false],
    ["src/*.ts", "src/nested/app.ts", false],
    ["src/**/app.ts", "src/app.ts", true],
    ["src/**/app.ts", "src/a/b/app.ts", true],
    ["docs/🔒.md", "docs/🔒.md", true],
  ])("keeps wildcards within their documented segment boundaries: %s and %s", (
    pattern,
    path,
    expected,
  ) => {
    expect(compileSecurityPackPathPattern(pattern).matches(path)).toBe(expected);
  });

  it.each([
    "",
    "/src/**",
    "../src/**",
    "src\\**",
    "src//a",
    "src/",
    "a[0]",
    "a{b,c}",
    "a@(b)",
    "C:/x",
    "a/**b/c",
    "a/./b",
  ])("rejects unsupported pattern %s", (pattern) => {
    expect(() => compileSecurityPackPathPattern(pattern)).toThrowError(
      expect.objectContaining({ code: "PACK_MANIFEST_INVALID" }),
    );
  });

  it.each([
    "",
    "/src/app.ts",
    "../src/app.ts",
    "src\\app.ts",
    "src//app.ts",
    "src/",
    "C:/src/app.ts",
    "src/./app.ts",
    "src/../app.ts",
  ])("rejects noncanonical repository path %s", (repositoryPath) => {
    const matcher = compileSecurityPackPathPattern("**/*.ts");
    expect(() => matcher.matches(repositoryPath)).toThrowError(
      expect.objectContaining({ code: "PACK_PATH_INVALID" }),
    );
  });

  it("handles adversarial wildcard depth within the deterministic operation bound", () => {
    const pattern = "**/a*a*a*a*a*a*a*a*.txt";
    let operations = 0;
    const matcher = compileSecurityPackPathPattern(pattern, () => {
      operations += 1;
    });
    const path = `${"x/".repeat(200)}${"a".repeat(512)}.txt`;

    expect(matcher.matches(path)).toBe(true);
    expect(operations).toBeLessThanOrEqual(2 * pattern.length * (path.length + 1));
  });
});
