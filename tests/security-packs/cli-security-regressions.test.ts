import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { runCli, type CliIo } from "@/packages/cli/run-cli";
import { SCAN_EXIT } from "@/packages/scanner-core/policy/exit-codes";
import {
  cleanupTask5Roots,
  createTask5Pack,
  task5TemporaryRoot,
} from "./task5-helpers";

const repositoryRoots: string[] = [];

function captureIo(): { io: CliIo; stdout: () => string; stderr: () => string } {
  let out = "";
  let err = "";
  return {
    io: {
      stdout(value) { out += value; },
      stderr(value) { err += value; },
    },
    stdout: () => out,
    stderr: () => err,
  };
}

async function repository(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "scopeforge-pack-cli-security-"));
  repositoryRoots.push(root);
  await writeFile(join(root, "Dockerfile"), "UNSAFE_SETTING=1\n");
  return root;
}

afterEach(async () => {
  await cleanupTask5Roots();
  await Promise.all(repositoryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("Security Pack CLI security regressions", () => {
  it("fails closed for invalid pack command and option combinations", async () => {
    const packRoot = await createTask5Pack();
    const repositoryRoot = await repository();
    const cases: Array<[string[], string]> = [
      [["pack"], "Unknown or missing pack command"],
      [["pack", "inspect", packRoot], "--json is required"],
      [["scan", repositoryRoot, "--pack"], "--pack requires a value"],
      [[
        "scan",
        repositoryRoot,
        "--pack",
        packRoot,
        "--format",
        "hosted-json",
        "--repository",
        "https://github.com/a/b",
      ], "Hosted JSON does not support Security Packs"],
      [["baseline", "create", repositoryRoot, "--pack", packRoot], "baseline create"],
    ];

    for (const [argv, message] of cases) {
      const capture = captureIo();
      expect(await runCli(argv, { io: capture.io })).toBe(SCAN_EXIT.USAGE_ERROR);
      expect(capture.stderr()).toContain(message);
      expect(capture.stdout()).toBe("");
    }
  });

  it("rejects more than ten selected pack arguments before filesystem access", async () => {
    const repositoryRoot = await repository();
    const argv = ["scan", repositoryRoot, "--format", "json"];
    for (let index = 0; index < 11; index += 1) {
      argv.push("--pack", `definitely-missing-pack-${index}`);
    }
    const capture = captureIo();

    expect(await runCli(argv, { io: capture.io })).toBe(SCAN_EXIT.USAGE_ERROR);
    expect(capture.stderr()).toContain("Selected pack count exceeds the fixed limit");
    expect(capture.stderr()).not.toContain("PACK_PATH_INVALID");
    expect(capture.stderr()).not.toContain("definitely-missing-pack-0");
  });

  it("does not reflect hostile manifest text or absolute pack paths in CLI errors", async () => {
    const hostilePack = await task5TemporaryRoot("scopeforge-pack-hostile-cli-");
    await mkdir(hostilePack, { recursive: true });
    await writeFile(
      join(hostilePack, "scopeforge-pack.json"),
      JSON.stringify({
        schemaVersion: 1,
        RAW_HOSTILE_SENTINEL: "RAW_HOSTILE_SENTINEL",
      }),
    );
    const capture = captureIo();

    expect(await runCli(["pack", "validate", hostilePack], { io: capture.io }))
      .toBe(SCAN_EXIT.USAGE_ERROR);
    expect(capture.stderr()).toContain("Security Pack error [PACK_MANIFEST_INVALID]");
    expect(capture.stderr()).not.toContain("RAW_HOSTILE_SENTINEL");
    expect(capture.stderr()).not.toContain(hostilePack);
  });

  it("never discovers a target repository Security Pack without explicit --pack", async () => {
    const repositoryRoot = await repository();
    const embeddedPack = await createTask5Pack();
    const manifest = await import("node:fs/promises").then(({ readFile }) =>
      readFile(join(embeddedPack, "scopeforge-pack.json"), "utf8"),
    );
    await writeFile(join(repositoryRoot, "scopeforge-pack.json"), manifest);
    const fixturePath = join(repositoryRoot, "fixtures", "positive", "repository");
    await mkdir(fixturePath, { recursive: true });
    await writeFile(join(fixturePath, "Dockerfile"), "UNSAFE_SETTING=1\n");

    const capture = captureIo();
    expect(await runCli(["scan", repositoryRoot, "--format", "json"], { io: capture.io }))
      .toBe(SCAN_EXIT.SUCCESS);
    const result = JSON.parse(capture.stdout());
    expect(result.findings.some((finding: { scanner: string }) => finding.scanner === "security-pack"))
      .toBe(false);
    expect(result.scan.scanners).not.toContain("security-pack");
  });
});
