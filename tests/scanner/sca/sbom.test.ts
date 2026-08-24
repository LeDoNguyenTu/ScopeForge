import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import { buildRepositoryInventory } from "@/packages/scanner-core/inventory/build-inventory";
import { generateCycloneDxSbom } from "@/packages/scanner-sca/sbom/generate";

const tempPaths: string[] = [];

async function tempRoot(prefix: string) {
  const root = await mkdtemp(join(tmpdir(), prefix));
  tempPaths.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(tempPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("generateCycloneDxSbom", () => {
  it("emits CycloneDX 1.7 with root metadata, npm components, tool metadata, and direct dependency edges", async () => {
    const root = await tempRoot("scopeforge-sbom-");
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({
        name: "demo-app",
        version: "1.2.3",
        dependencies: { lodash: "4.17.20" },
        devDependencies: { vitest: "3.2.4" }
      })
    );
    await writeFile(
      join(root, "package-lock.json"),
      JSON.stringify({
        lockfileVersion: 3,
        packages: {
          "": {
            name: "demo-app",
            version: "1.2.3",
            dependencies: { lodash: "4.17.20" },
            devDependencies: { vitest: "3.2.4" }
          },
          "node_modules/lodash": { version: "4.17.20" },
          "node_modules/vitest": { version: "3.2.4" },
          "node_modules/vitest/node_modules/tinybench": { version: "2.9.0" }
        }
      })
    );

    const inventory = await buildRepositoryInventory(root);
    const fixed = {
      toolVersion: "0.1.0",
      timestamp: new Date("2026-08-24T09:30:00.000Z"),
      serialNumber: "urn:uuid:11111111-2222-4333-8444-555555555555"
    };

    const first = await generateCycloneDxSbom(inventory, fixed);
    const second = await generateCycloneDxSbom(inventory, fixed);

    expect(first.errors).toEqual([]);
    expect(first.sbom).toBeDefined();
    expect(second).toEqual(first);

    const parsed = JSON.parse(first.sbom ?? "null");
    expect(parsed).toMatchObject({
      bomFormat: "CycloneDX",
      specVersion: "1.7",
      serialNumber: fixed.serialNumber,
      version: 1,
      metadata: {
        timestamp: "2026-08-24T09:30:00.000Z",
        component: {
          type: "application",
          name: "demo-app",
          version: "1.2.3",
          purl: "pkg:npm/demo-app@1.2.3"
        }
      }
    });

    expect(parsed.metadata.tools.components).toEqual([
      expect.objectContaining({ type: "application", name: "ScopeForge", version: "0.1.0" })
    ]);
    expect(parsed.components.map((component: { name: string; version: string; purl: string }) => ({
      name: component.name,
      version: component.version,
      purl: component.purl
    }))).toEqual([
      { name: "lodash", version: "4.17.20", purl: "pkg:npm/lodash@4.17.20" },
      { name: "tinybench", version: "2.9.0", purl: "pkg:npm/tinybench@2.9.0" },
      { name: "vitest", version: "3.2.4", purl: "pkg:npm/vitest@3.2.4" }
    ]);

    const rootRef = parsed.metadata.component["bom-ref"];
    const directRefs = parsed.components
      .filter((component: { name: string }) => component.name === "lodash" || component.name === "vitest")
      .map((component: { "bom-ref": string }) => component["bom-ref"])
      .sort();
    expect(parsed.dependencies.find((entry: { ref: string }) => entry.ref === rootRef)?.dependsOn.sort()).toEqual(directRefs);
  });

  it("falls back to the repository directory name when no root package metadata exists", async () => {
    const root = await tempRoot("scopeforge-sbom-fallback-");
    const inventory = await buildRepositoryInventory(root);

    const result = await generateCycloneDxSbom(inventory, {
      toolVersion: "0.1.0",
      timestamp: new Date("2026-08-24T09:30:00.000Z"),
      serialNumber: "urn:uuid:aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
    });

    expect(result.errors).toEqual([]);
    const parsed = JSON.parse(result.sbom ?? "null");
    expect(parsed.metadata.component).toMatchObject({
      type: "application",
      name: basename(root)
    });
  });

  it("returns dependency parse errors and no SBOM instead of emitting an incomplete artifact", async () => {
    const root = await tempRoot("scopeforge-sbom-invalid-");
    await writeFile(join(root, "package-lock.json"), "{ malformed");
    const inventory = await buildRepositoryInventory(root);

    const result = await generateCycloneDxSbom(inventory, {
      toolVersion: "0.1.0",
      timestamp: new Date("2026-08-24T09:30:00.000Z"),
      serialNumber: "urn:uuid:12345678-1234-4234-8234-123456789abc"
    });

    expect(result.sbom).toBeUndefined();
    expect(result.errors).toEqual([
      expect.objectContaining({ code: "invalid_lockfile", file: "package-lock.json" })
    ]);
  });
});
