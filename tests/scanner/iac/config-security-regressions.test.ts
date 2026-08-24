import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { formatBuiltInRuleList } from "@/packages/cli/builtins";
import { runCli } from "@/packages/cli/run-cli";

const tempPaths: string[] = [];

async function tempDir(prefix: string) {
  const path = await mkdtemp(join(tmpdir(), prefix));
  tempPaths.push(path);
  return path;
}

function captureIo() {
  let stdout = "";
  let stderr = "";
  return {
    io: {
      stdout(value: string) { stdout += value; },
      stderr(value: string) { stderr += value; }
    },
    serialized: () => JSON.stringify({ stdout, stderr })
  };
}

afterEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all(tempPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("configuration security regressions", () => {
  it("does not initiate network requests or execute configuration content", async () => {
    const root = await tempDir("scopeforge-config-security-");
    const network = vi.fn(async () => {
      throw new Error("configuration scanning must not use network");
    });
    vi.stubGlobal("fetch", network);
    await writeFile(join(root, ".npmrc"), "strict-ssl=false\nscript=node -e evil()\n");

    expect(await runCli(["scan", root], { io: captureIo().io })).toBe(0);
    expect(network).not.toHaveBeenCalled();
  });

  it("keeps arbitrary configuration values out of terminal and JSON finding evidence", async () => {
    const root = await tempDir("scopeforge-config-no-leak-");
    const sentinel = "CONFIG_SOURCE_SENTINEL_13af";
    await writeFile(join(root, ".npmrc"), `strict-ssl=false\n//registry.example/:_authToken=${sentinel}\n`);
    await writeFile(
      join(root, "vercel.json"),
      JSON.stringify({
        headers: [
          {
            source: `/${sentinel}`,
            headers: [
              { key: "Access-Control-Allow-Origin", value: "*" },
              { key: "X-Internal", value: sentinel }
            ]
          }
        ]
      })
    );

    const terminal = captureIo();
    expect(await runCli(["scan", root], { io: terminal.io })).toBe(0);
    expect(terminal.serialized()).not.toContain(sentinel);

    const json = captureIo();
    expect(await runCli(["scan", root, "--format", "json"], { io: json.io })).toBe(0);
    expect(json.serialized()).not.toContain(sentinel);
  });

  it("publishes configuration rules through the existing built-in registry", () => {
    const rules = formatBuiltInRuleList();
    expect(rules).toContain("iac/config-npm-strict-ssl-disabled\t1.0.0\tnpm TLS certificate verification disabled");
    expect(rules).toContain("iac/config-vercel-wildcard-cors\t1.0.0\tWildcard CORS header in Vercel configuration");
  });
});
