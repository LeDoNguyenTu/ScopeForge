import { describe, expect, it } from "vitest";

import { parsePackageJson } from "@/packages/scanner-sca/manifests/package-json";

describe("parsePackageJson", () => {
  it("normalizes exact and ranged fallback dependencies without pretending ranges are resolved", () => {
    const result = parsePackageJson({
      file: "package.json",
      content: JSON.stringify({
        dependencies: {
          lodash: "4.17.20",
          express: "^5.1.0"
        },
        devDependencies: {
          lodash: "^4.0.0",
          vitest: "3.2.4"
        },
        optionalDependencies: {
          fsevents: "~2.3.3"
        },
        peerDependencies: {
          react: ">=19"
        }
      })
    });

    expect(result.errors).toEqual([]);
    expect(
      result.components.map(({ name, version, certainty, queryable, dependencyGroup }) => ({
        name,
        version,
        certainty,
        queryable,
        dependencyGroup
      }))
    ).toEqual([
      {
        name: "express",
        version: "^5.1.0",
        certainty: "manifest_range",
        queryable: false,
        dependencyGroup: "runtime"
      },
      {
        name: "fsevents",
        version: "~2.3.3",
        certainty: "manifest_range",
        queryable: false,
        dependencyGroup: "optional"
      },
      {
        name: "lodash",
        version: "4.17.20",
        certainty: "manifest_exact",
        queryable: true,
        dependencyGroup: "runtime"
      },
      {
        name: "react",
        version: ">=19",
        certainty: "manifest_range",
        queryable: false,
        dependencyGroup: "peer"
      },
      {
        name: "vitest",
        version: "3.2.4",
        certainty: "manifest_exact",
        queryable: true,
        dependencyGroup: "development"
      }
    ]);
  });

  it("rejects malformed manifests and non-string dependency versions", () => {
    const malformed = parsePackageJson({ file: "package.json", content: "not json" });
    expect(malformed.components).toEqual([]);
    expect(malformed.errors[0]?.code).toBe("invalid_manifest");

    const wrongShape = parsePackageJson({
      file: "package.json",
      content: JSON.stringify({ dependencies: { lodash: { version: "4.17.20" } } })
    });
    expect(wrongShape.components).toEqual([]);
    expect(wrongShape.errors[0]?.code).toBe("invalid_manifest");
  });
});
