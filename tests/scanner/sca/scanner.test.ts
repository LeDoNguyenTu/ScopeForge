import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildRepositoryInventory } from "@/packages/scanner-core/inventory/build-inventory";
import { createScaScanner } from "@/packages/scanner-sca/scanner";

const tempPaths: string[] = [];

async function fixtureRoot(lockfile: string) {
  const root = await mkdtemp(join(tmpdir(), "scopeforge-sca-scanner-"));
  tempPaths.push(root);
  await writeFile(join(root, "package-lock.json"), lockfile);
  return root;
}

function lodashLockfile() {
  return JSON.stringify({
    lockfileVersion: 3,
    packages: {
      "": { dependencies: { lodash: "4.17.20" } },
      "node_modules/lodash": { version: "4.17.20" }
    }
  });
}

afterEach(async () => {
  await Promise.all(tempPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("createScaScanner", () => {
  it("stays offline by default while still validating local dependency metadata", async () => {
    const root = await fixtureRoot(lodashLockfile());
    const inventory = await buildRepositoryInventory(root);
    const fetchImpl = vi.fn(async () => {
      throw new Error("network must not be used");
    });

    const scanner = createScaScanner({ osv: { enabled: false, fetchImpl } });
    const result = await scanner.scan({ root, inventory });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result).toEqual({ findings: [], errors: [] });
  });

  it("returns local parse errors offline instead of treating malformed lockfiles as clean", async () => {
    const root = await fixtureRoot("{ malformed");
    const inventory = await buildRepositoryInventory(root);

    const result = await createScaScanner().scan({ root, inventory });

    expect(result.findings).toEqual([]);
    expect(result.errors).toEqual([
      expect.objectContaining({ code: "invalid_lockfile", file: "package-lock.json" })
    ]);
  });

  it("emits normalized dependency-confirmed findings when OSV enrichment is enabled", async () => {
    const root = await fixtureRoot(lodashLockfile());
    const inventory = await buildRepositoryInventory(root);
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/querybatch")) {
        return new Response(JSON.stringify({ results: [{ vulns: [{ id: "GHSA-test", modified: "2026-01-01T00:00:00Z" }] }] }), {
          status: 200
        });
      }
      return new Response(JSON.stringify({
        id: "GHSA-test",
        aliases: ["CVE-2026-1234", "CVE-2026-1234"],
        summary: "Prototype pollution in lodash",
        database_specific: {
          severity: "HIGH",
          cwe_ids: ["CWE-1321", "not-a-cwe"]
        },
        affected: [{
          package: { ecosystem: "npm", name: "lodash" },
          ranges: [{ type: "SEMVER", events: [{ introduced: "0" }, { fixed: "4.17.21" }] }]
        }],
        references: [{ type: "ADVISORY", url: "https://example.test/advisory" }]
      }), { status: 200 });
    });

    const result = await createScaScanner({ osv: { enabled: true, fetchImpl } }).scan({ root, inventory });

    expect(result.errors).toEqual([]);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]).toMatchObject({
      scanner: "sca",
      ruleId: "sca/known-vulnerability",
      ruleVersion: "1.0.0",
      severity: "high",
      confidence: "high",
      category: "dependency",
      validation: "dependency_confirmed",
      provenance: "enriched",
      location: { file: "package-lock.json" },
      cwe: ["CWE-1321"],
      metadata: {
        packageName: "lodash",
        packageVersion: "4.17.20",
        osvId: "GHSA-test",
        aliases: ["CVE-2026-1234"],
        fixedVersions: ["4.17.21"],
        upstreamSeverity: "HIGH"
      }
    });
    expect(result.findings[0]?.references).toContain("https://osv.dev/vulnerability/GHSA-test");
    expect(result.findings[0]?.remediation.guidance).toContain("4.17.21");
  });

  it("returns an OSV diagnostic and no findings when enrichment fails", async () => {
    const root = await fixtureRoot(lodashLockfile());
    const inventory = await buildRepositoryInventory(root);

    const result = await createScaScanner({
      osv: { enabled: true, fetchImpl: async () => new Response("unavailable", { status: 503 }) }
    }).scan({ root, inventory });

    expect(result.findings).toEqual([]);
    expect(result.errors[0]?.code).toBe("osv_lookup_failed");
  });
});
