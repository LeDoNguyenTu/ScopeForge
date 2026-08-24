import { describe, expect, it } from "vitest";

import { parsePnpmLock } from "@/packages/scanner-sca/lockfiles/pnpm-lock";

describe("parsePnpmLock", () => {
  it("parses only package entries from the packages section", () => {
    const content = [
      "lockfileVersion: '9.0'",
      "importers:",
      "  .:",
      "    dependencies:",
      "      fake-entry:",
      "        version: 9.9.9",
      "packages:",
      "  lodash@4.17.20:",
      "    resolution: {integrity: sha512-safe}",
      "  '@scope/pkg@1.2.3':",
      "    resolution: {integrity: sha512-safe}",
      "  react-dom@19.1.0(react@19.1.0):",
      "    resolution: {integrity: sha512-safe}",
      "snapshots:",
      "  misleading@8.8.8:",
      "    dependencies: {}"
    ].join("\n");

    const result = parsePnpmLock({ file: "pnpm-lock.yaml", content });

    expect(result.errors).toEqual([]);
    expect(result.components.map(({ name, version, purl }) => ({ name, version, purl }))).toEqual([
      { name: "@scope/pkg", version: "1.2.3", purl: "pkg:npm/%40scope/pkg@1.2.3" },
      { name: "lodash", version: "4.17.20", purl: "pkg:npm/lodash@4.17.20" },
      { name: "react-dom", version: "19.1.0", purl: "pkg:npm/react-dom@19.1.0" }
    ]);
    expect(result.components.every((component) => component.certainty === "resolved")).toBe(true);
    expect(result.components.every((component) => component.queryable)).toBe(true);
  });

  it("supports slash-style legacy package keys", () => {
    const result = parsePnpmLock({
      file: "pnpm-lock.yaml",
      content: [
        "lockfileVersion: 6.0",
        "packages:",
        "  /lodash@4.17.21:",
        "    resolution: {}",
        "  /@scope/pkg/2.0.0:",
        "    resolution: {}"
      ].join("\n")
    });

    expect(result.errors).toEqual([]);
    expect(result.components.map(({ name, version }) => ({ name, version }))).toEqual([
      { name: "@scope/pkg", version: "2.0.0" },
      { name: "lodash", version: "4.17.21" }
    ]);
  });

  it("fails closed on an oversized hostile line", () => {
    const result = parsePnpmLock({
      file: "pnpm-lock.yaml",
      content: `packages:\n  lodash@4.17.20:${"x".repeat(70_000)}`
    });

    expect(result.components).toEqual([]);
    expect(result.errors[0]?.code).toBe("invalid_lockfile");
  });
});
