import { describe, expect, it } from "vitest";

import { parsePackageLock } from "@/packages/scanner-sca/lockfiles/package-lock";

describe("parsePackageLock", () => {
  it("parses resolved npm lockfile v3 packages with scoped and nested identities", () => {
    const content = JSON.stringify(
      {
        name: "fixture",
        lockfileVersion: 3,
        packages: {
          "": { dependencies: { lodash: "4.17.20", "@scope/pkg": "1.2.3" } },
          "node_modules/lodash": { version: "4.17.20" },
          "node_modules/@scope/pkg": { version: "1.2.3" },
          "node_modules/parent/node_modules/lodash": { version: "4.17.21" }
        }
      },
      null,
      2
    );

    const result = parsePackageLock({ file: "package-lock.json", content });

    expect(result.errors).toEqual([]);
    expect(
      result.components.map(({ name, version, purl, direct, certainty }) => ({
        name,
        version,
        purl,
        direct,
        certainty
      }))
    ).toEqual([
      {
        name: "@scope/pkg",
        version: "1.2.3",
        purl: "pkg:npm/%40scope/pkg@1.2.3",
        direct: true,
        certainty: "resolved"
      },
      {
        name: "lodash",
        version: "4.17.20",
        purl: "pkg:npm/lodash@4.17.20",
        direct: true,
        certainty: "resolved"
      },
      {
        name: "lodash",
        version: "4.17.21",
        purl: "pkg:npm/lodash@4.17.21",
        direct: false,
        certainty: "resolved"
      }
    ]);
    expect(result.components.every((component) => component.sourceLine > 0)).toBe(true);
  });

  it("parses npm lockfile v1 dependency trees and deduplicates repeated package versions", () => {
    const content = JSON.stringify(
      {
        lockfileVersion: 1,
        dependencies: {
          alpha: {
            version: "1.0.0",
            dependencies: {
              beta: { version: "2.0.0" }
            }
          },
          beta: { version: "2.0.0" }
        }
      },
      null,
      2
    );

    const result = parsePackageLock({ file: "npm-shrinkwrap.json", content });

    expect(result.errors).toEqual([]);
    expect(result.components.map(({ name, version, direct }) => ({ name, version, direct }))).toEqual([
      { name: "alpha", version: "1.0.0", direct: true },
      { name: "beta", version: "2.0.0", direct: true }
    ]);
  });

  it("fails closed on malformed or unsupported lockfile structure", () => {
    const malformed = parsePackageLock({ file: "package-lock.json", content: "{ not json" });
    expect(malformed.components).toEqual([]);
    expect(malformed.errors[0]?.code).toBe("invalid_lockfile");

    const unsupported = parsePackageLock({
      file: "package-lock.json",
      content: JSON.stringify({ lockfileVersion: 99, packages: {} })
    });
    expect(unsupported.components).toEqual([]);
    expect(unsupported.errors[0]?.code).toBe("unsupported_lockfile");
  });
});
