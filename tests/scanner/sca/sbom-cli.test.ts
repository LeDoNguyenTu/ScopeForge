import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runCli } from "@/packages/cli/run-cli";
import { SCAN_EXIT } from "@/packages/scanner-core/policy/exit-codes";

const tempPaths: string[] = [];

function captureIo() {
  let stdout = "";
  let stderr = "";
  return {
    io: {
      stdout: (value: string) => {
        stdout += value;
      },
      stderr: (value: string) => {
        stderr += value;
      }
    },
    get stdout() {
      return stdout;
    },
    get stderr() {
      return stderr;
    }
  };
}

async function dependencyRoot(prefix: string) {
  const root = await mkdtemp(join(tmpdir(), prefix));
  tempPaths.push(root);
  await writeFile(join(root, "package.json"), JSON.stringify({ name: "sbom-cli-app", version: "1.0.0" }));
  await writeFile(
    join(root, "package-lock.json"),
    JSON.stringify({
      lockfileVersion: 3,
      packages: {
        "": { name: "sbom-cli-app", version: "1.0.0", dependencies: { lodash: "4.17.20" } },
        "node_modules/lodash": { version: "4.17.20" }
      }
    })
  );
  return root;
}

afterEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all(tempPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("CycloneDX SBOM CLI", () => {
  it("writes an offline CycloneDX artifact without changing normal scan output", async () => {
    const root = await dependencyRoot("scopeforge-sbom-cli-");
    const fetchSpy = vi.fn(async (): Promise<Response> => {
      throw new Error("SBOM generation must not use the network");
    });
    vi.stubGlobal("fetch", fetchSpy);
    const capture = captureIo();

    expect(await runCli(["scan", root, "--sbom", "scopeforge.cdx.json"], { io: capture.io })).toBe(
      SCAN_EXIT.SUCCESS
    );

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(capture.stdout).toContain("ScopeForge scan");
    expect(capture.stderr).toBe("");

    const sbom = JSON.parse(await readFile(join(root, "scopeforge.cdx.json"), "utf8"));
    expect(sbom).toMatchObject({
      bomFormat: "CycloneDX",
      specVersion: "1.7",
      metadata: {
        component: { type: "application", name: "sbom-cli-app", version: "1.0.0" }
      }
    });
    expect(sbom.components).toEqual([
      expect.objectContaining({ name: "lodash", version: "4.17.20", purl: "pkg:npm/lodash@4.17.20" })
    ]);
  });

  it("refuses to write an SBOM through a symlink", async () => {
    const root = await dependencyRoot("scopeforge-sbom-cli-symlink-");
    const outside = await mkdtemp(join(tmpdir(), "scopeforge-sbom-cli-outside-"));
    tempPaths.push(outside);
    const victim = join(outside, "victim.json");
    await writeFile(victim, "preserve me\n");
    await symlink(victim, join(root, "scopeforge.cdx.json"));
    const capture = captureIo();

    expect(await runCli(["scan", root, "--sbom", "scopeforge.cdx.json"], { io: capture.io })).toBe(
      SCAN_EXIT.USAGE_ERROR
    );
    expect(await readFile(victim, "utf8")).toBe("preserve me\n");
    expect(capture.stderr).toContain("Unsafe output");
  });

  it("returns scanner-error semantics when local dependency metadata prevents SBOM generation", async () => {
    const root = await mkdtemp(join(tmpdir(), "scopeforge-sbom-cli-invalid-"));
    tempPaths.push(root);
    await writeFile(join(root, "package-lock.json"), "{ malformed");
    const capture = captureIo();

    expect(
      await runCli(["scan", root, "--sbom", "scopeforge.cdx.json"], { io: capture.io, scanners: [] })
    ).toBe(SCAN_EXIT.SCANNER_ERROR);
    await expect(readFile(join(root, "scopeforge.cdx.json"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    expect(capture.stderr).toContain("SBOM error");
  });

  it("refuses to let normal scan output and the SBOM target the same file", async () => {
    const root = await dependencyRoot("scopeforge-sbom-cli-collision-");
    const capture = captureIo();

    expect(
      await runCli(
        ["scan", root, "--format", "json", "--output", "artifact.json", "--sbom", "artifact.json"],
        { io: capture.io }
      )
    ).toBe(SCAN_EXIT.USAGE_ERROR);
    await expect(readFile(join(root, "artifact.json"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    expect(capture.stderr).toContain("different path");
  });
});
