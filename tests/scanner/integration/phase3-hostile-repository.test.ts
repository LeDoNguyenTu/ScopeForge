import { afterEach, describe, expect, it, vi } from "vitest";
import { access, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runCli } from "@/packages/cli/run-cli";
import { SCAN_EXIT } from "@/packages/scanner-core/policy/exit-codes";

const tempPaths: string[] = [];
const SOURCE_SENTINEL = "HOSTILE_SOURCE_SENTINEL_9c41";
const CONFIG_SENTINEL = "HOSTILE_CONFIG_SENTINEL_62ad";
const OUTSIDE_SECRET = "ghp_" + "Q1w2E3r4T5y6U7i8O9p0A1s2D3f4G5h6J7k8";

async function tempDir(prefix: string): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), prefix));
  tempPaths.push(path);
  return path;
}

function captureIo() {
  let stdout = "";
  let stderr = "";
  return {
    io: {
      stdout: (value: string) => { stdout += value; },
      stderr: (value: string) => { stderr += value; }
    },
    get stdout() { return stdout; },
    get stderr() { return stderr; }
  };
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function buildHostileRepository(root: string, outside: string, marker: string): Promise<void> {
  await mkdir(join(root, "src"), { recursive: true });
  await mkdir(join(root, "deploy"), { recursive: true });

  await writeFile(
    join(root, ".scopeforge.json"),
    JSON.stringify({
      version: 1,
      sca: { osv: { enabled: false } },
      budgets: { maxFileBytes: 1024 }
    }, null, 2)
  );

  await writeFile(
    join(root, "src", "do-not-run.ts"),
    [
      "import { writeFileSync } from 'node:fs';",
      `writeFileSync(${JSON.stringify(marker)}, ${JSON.stringify(SOURCE_SENTINEL)});`,
      "eval('1 + 1');"
    ].join("\n")
  );
  await writeFile(
    join(root, "package.json"),
    JSON.stringify({
      name: "hostile-fixture",
      version: "1.0.0",
      scripts: {
        preinstall: `node -e \"require('fs').writeFileSync('${marker}','${SOURCE_SENTINEL}')\"`
      }
    }, null, 2)
  );
  await writeFile(join(root, "package-lock.json"), `{ "packages": [${CONFIG_SENTINEL}`);
  await writeFile(join(root, "vercel.json"), `{ "headers": [${CONFIG_SENTINEL}`);
  await writeFile(
    join(root, "deploy", "broken.yaml"),
    `apiVersion: v1\nkind: Pod\nspec: [\n${CONFIG_SENTINEL}`
  );
  await writeFile(join(root, "src", "oversized.ts"), "x".repeat(2048));

  await writeFile(join(outside, "outside-secret.txt"), OUTSIDE_SECRET);
  await symlink(join(outside, "outside-secret.txt"), join(root, "outside-link.txt"));
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(tempPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("Phase 3 hostile repository completion contract", () => {
  it("never executes target content, follows symlinks, performs default network access, or reports malformed coverage as clean", async () => {
    const root = await tempDir("scopeforge-hostile-");
    const outside = await tempDir("scopeforge-hostile-outside-");
    const marker = join(outside, "execution-marker.txt");
    await buildHostileRepository(root, outside, marker);

    const fetchGuard = vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      throw new Error("unexpected scanner network access");
    });
    const capture = captureIo();

    expect(await runCli(["scan", root, "--format", "json"], { io: capture.io })).toBe(
      SCAN_EXIT.SCANNER_ERROR
    );
    expect(fetchGuard).not.toHaveBeenCalled();
    expect(await exists(marker)).toBe(false);

    const parsed = JSON.parse(capture.stdout);
    expect(parsed.errors.length).toBeGreaterThanOrEqual(2);
    expect(parsed.inventory.skippedByReason.symlink).toBeGreaterThanOrEqual(1);
    expect(parsed.inventory.skippedByReason.file_too_large).toBeGreaterThanOrEqual(1);
    expect(parsed.findings.map((finding: { ruleId: string }) => finding.ruleId)).toContain(
      "jsts/dynamic-code-execution"
    );

    const combined = `${capture.stdout}\n${capture.stderr}`;
    expect(combined).not.toContain(SOURCE_SENTINEL);
    expect(combined).not.toContain(CONFIG_SENTINEL);
    expect(combined).not.toContain(OUTSIDE_SECRET);
  });

  it("keeps hostile source/configuration sentinels out of terminal and SARIF output as well", async () => {
    const root = await tempDir("scopeforge-hostile-output-");
    const outside = await tempDir("scopeforge-hostile-output-outside-");
    const marker = join(outside, "execution-marker.txt");
    await buildHostileRepository(root, outside, marker);

    for (const format of ["terminal", "sarif"] as const) {
      const capture = captureIo();
      expect(await runCli(["scan", root, "--format", format], { io: capture.io })).toBe(
        SCAN_EXIT.SCANNER_ERROR
      );
      const combined = `${capture.stdout}\n${capture.stderr}`;
      expect(combined).not.toContain(SOURCE_SENTINEL);
      expect(combined).not.toContain(CONFIG_SENTINEL);
      expect(combined).not.toContain(OUTSIDE_SECRET);
    }

    expect(await exists(marker)).toBe(false);
  });
});
