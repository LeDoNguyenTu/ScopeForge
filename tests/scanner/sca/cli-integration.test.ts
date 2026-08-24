import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
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

async function dependencyRoot() {
  const root = await mkdtemp(join(tmpdir(), "scopeforge-sca-cli-"));
  tempPaths.push(root);
  await writeFile(
    join(root, "package-lock.json"),
    JSON.stringify({
      lockfileVersion: 3,
      packages: {
        "": { dependencies: { lodash: "4.17.20" } },
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

describe("SCA CLI integration", () => {
  it("keeps the default CLI scan offline even when dependency metadata is present", async () => {
    const root = await dependencyRoot();
    const fetchSpy = vi.fn(async (): Promise<Response> => {
      throw new Error("network must remain disabled by default");
    });
    vi.stubGlobal("fetch", fetchSpy);
    const capture = captureIo();

    expect(await runCli(["scan", root, "--format", "json"], { io: capture.io })).toBe(SCAN_EXIT.SUCCESS);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(JSON.parse(capture.stdout).findings).toEqual([]);
    expect(capture.stderr).toBe("");
  });

  it("enables OSV enrichment only through explicit root configuration", async () => {
    const root = await dependencyRoot();
    await writeFile(
      join(root, ".scopeforge.json"),
      JSON.stringify({
        version: 1,
        scanners: ["sca"],
        sca: { osv: { enabled: true } }
      })
    );

    const fetchSpy = vi.fn(async (input: string | URL | Request): Promise<Response> => {
      const url = String(input);
      if (url.endsWith("/querybatch")) {
        return new Response(JSON.stringify({ results: [{ vulns: [{ id: "GHSA-cli-test" }] }] }), { status: 200 });
      }
      return new Response(
        JSON.stringify({
          id: "GHSA-cli-test",
          aliases: ["CVE-2026-9999"],
          summary: "CLI integration advisory",
          database_specific: { severity: "LOW" },
          affected: [],
          references: []
        }),
        { status: 200 }
      );
    });
    vi.stubGlobal("fetch", fetchSpy);
    const capture = captureIo();

    expect(await runCli(["scan", root, "--format", "json"], { io: capture.io })).toBe(SCAN_EXIT.SUCCESS);
    const output = JSON.parse(capture.stdout);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(output.findings).toHaveLength(1);
    expect(output.findings[0]).toMatchObject({
      scanner: "sca",
      ruleId: "sca/known-vulnerability",
      severity: "low",
      metadata: {
        packageName: "lodash",
        packageVersion: "4.17.20",
        osvId: "GHSA-cli-test"
      }
    });
    expect(capture.stderr).toBe("");
  });
});
