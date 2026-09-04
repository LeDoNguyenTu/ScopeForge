import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { runCli, type CliIo } from "@/packages/cli/run-cli";
import { SCAN_EXIT } from "@/packages/scanner-core/policy/exit-codes";
import {
  cleanupTask5Roots,
  createTask5Pack,
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

async function repository(files: Readonly<Record<string, string>>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "scopeforge-pack-cli-repo-"));
  repositoryRoots.push(root);
  for (const [path, contents] of Object.entries(files)) {
    const absolute = join(root, ...path.split("/"));
    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, contents);
  }
  return root;
}

afterEach(async () => {
  await cleanupTask5Roots();
  await Promise.all(repositoryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("Security Pack CLI workflows", () => {
  it("validates, inspects, and scans only explicitly selected packs", async () => {
    const packRoot = await createTask5Pack();
    const repositoryRoot = await repository({ Dockerfile: "UNSAFE_SETTING=1\n" });

    const validate = captureIo();
    expect(await runCli(["pack", "validate", packRoot], { io: validate.io })).toBe(SCAN_EXIT.SUCCESS);
    expect(validate.stdout()).toBe(
      "Security Pack valid: org.scopeforge.fixtures@1.0.0 (1 rules, 3 cases)\n",
    );
    expect(validate.stderr()).toBe("");

    const inspect = captureIo();
    expect(await runCli(["pack", "inspect", packRoot, "--json"], { io: inspect.io }))
      .toBe(SCAN_EXIT.SUCCESS);
    expect(JSON.parse(inspect.stdout()).pack.id).toBe("org.scopeforge.fixtures");
    expect(inspect.stdout()).not.toContain("UNSAFE_SETTING=1");
    expect(inspect.stdout()).not.toContain(packRoot);

    await writeFile(
      join(repositoryRoot, "scopeforge-pack.json"),
      await readFile(join(packRoot, "scopeforge-pack.json"), "utf8"),
    );

    const withoutFlag = captureIo();
    expect(await runCli(["scan", repositoryRoot, "--format", "json"], { io: withoutFlag.io }))
      .toBe(SCAN_EXIT.SUCCESS);
    expect(JSON.parse(withoutFlag.stdout()).findings
      .filter((finding: { scanner: string }) => finding.scanner === "security-pack"))
      .toHaveLength(0);

    const selected = captureIo();
    expect(await runCli(
      ["scan", repositoryRoot, "--pack", packRoot, "--format", "json"],
      { io: selected.io },
    )).toBe(SCAN_EXIT.SUCCESS);
    const selectedFindings = JSON.parse(selected.stdout()).findings
      .filter((finding: { scanner: string }) => finding.scanner === "security-pack");
    expect(selectedFindings).toHaveLength(1);
    expect(selectedFindings[0].ruleId)
      .toBe("pack/org.scopeforge.fixtures/config/unsafe-setting");
  });

  it("resolves explicit pack paths against CLI cwd rather than the scanned repository", async () => {
    const packRoot = await createTask5Pack();
    const repositoryRoot = await repository({ Dockerfile: "UNSAFE_SETTING=1\n" });
    const capture = captureIo();

    expect(await runCli(
      ["scan", repositoryRoot, "--pack", basename(packRoot), "--format", "json"],
      { io: capture.io, cwd: dirname(packRoot) },
    )).toBe(SCAN_EXIT.SUCCESS);

    expect(JSON.parse(capture.stdout()).findings
      .some((finding: { scanner: string }) => finding.scanner === "security-pack"))
      .toBe(true);
  });

  it("supports repeated explicitly selected packs without changing baseline creation semantics", async () => {
    const firstPack = await createTask5Pack();
    const secondPack = await createTask5Pack();
    const repositoryRoot = await repository({ Dockerfile: "UNSAFE_SETTING=1\n" });

    const selected = captureIo();
    const exit = await runCli([
      "scan",
      repositoryRoot,
      "--pack",
      firstPack,
      "--pack",
      secondPack,
      "--format",
      "json",
    ], { io: selected.io });

    expect(exit).toBe(SCAN_EXIT.USAGE_ERROR);
    expect(selected.stderr()).toContain("PACK_RULE_COLLISION");

    const baseline = captureIo();
    expect(await runCli(["baseline", "create", repositoryRoot], { io: baseline.io }))
      .toBe(SCAN_EXIT.SUCCESS);
    expect(baseline.stderr()).toBe("");
  });
});
