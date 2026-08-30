import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

async function filesUnder(relative: string): Promise<string[]> {
  const directory = path.join(root, relative);
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) return filesUnder(child);
    return /\.(?:ts|tsx|mts|cts|js|mjs|cjs)$/.test(entry.name) ? [child] : [];
  }));
  return nested.flat();
}

async function source(relative: string): Promise<string> {
  return readFile(path.join(root, relative), "utf8");
}

async function sourcesUnder(relative: string): Promise<Array<{ file: string; code: string }>> {
  return Promise.all((await filesUnder(relative)).map(async (file) => ({ file, code: await source(file) })));
}

const RAW_NETWORK_IMPORT = /from\s+["'](?:node:)?(?:http|https|net|tls|dns|dgram|undici)["']|require\(\s*["'](?:node:)?(?:http|https|net|tls|dns|dgram|undici)["']\s*\)/;
const RUNTIME_NETWORK_IMPORT = /(?:@\/packages\/runtime-network|packages\/runtime-network|\.\.?\/.*runtime-network)/;
const MEDIATOR_IMPORT = /(?:@\/packages\/runtime-worker-mediator|packages\/runtime-worker-mediator|\.\.?\/.*runtime-worker-mediator)/;

describe("Phase 6D authority architecture", () => {
  it("keeps Phase 6D raw network ownership inside runtime-network and runtime-worker-mediator", async () => {
    const phase6dRoots = [
      "lib/runtime-workers",
      "packages/runtime-observer",
      "packages/runtime-validator",
      "packages/runtime-worker-mediator",
      "packages/runtime-worker-runner",
      "packages/runtime-worker-sandbox",
      "packages/worker-supervisor",
    ];
    const all = (await Promise.all(phase6dRoots.map(sourcesUnder))).flat();
    const offenders = all.filter(({ file, code }) =>
      RAW_NETWORK_IMPORT.test(code)
      && !file.startsWith("packages/runtime-network/")
      && !file.startsWith("packages/runtime-worker-mediator/"),
    );
    expect(offenders.map(({ file }) => file)).toEqual([]);
  });

  it("keeps worker-supervisor executors free of raw network and runtime-network authority", async () => {
    const files = await sourcesUnder("packages/worker-supervisor");
    const offenders = files.filter(({ code }) => RAW_NETWORK_IMPORT.test(code) || RUNTIME_NETWORK_IMPORT.test(code));
    expect(offenders.map(({ file }) => file)).toEqual([]);
  });

  it("keeps dashboard and server actions away from runtime-network and mediator internals", async () => {
    const files = (await sourcesUnder("app")).filter(({ file }) => /actions?\.(?:ts|tsx)$/.test(file));
    const offenders = files.filter(({ code }) => RUNTIME_NETWORK_IMPORT.test(code) || MEDIATOR_IMPORT.test(code));
    expect(offenders.map(({ file }) => file)).toEqual([]);
  });

  it("keeps mediator independent from persistence, acquisition, scanners, providers, browsers, and process escape hatches", async () => {
    const files = await sourcesUnder("packages/runtime-worker-mediator");
    const forbidden = /(?:@supabase\/|createAdminClient|lib\/database|lib\/repository|repository-acquisition-network|repository-snapshot|hosted-scanner-runner|scanner-core|scanner-jsts|scanner-iac|openai|anthropic|gemini|playwright|puppeteer|node:child_process|node:vm|node:worker_threads)/i;
    const offenders = files.filter(({ code }) => forbidden.test(code));
    expect(offenders.map(({ file }) => file)).toEqual([]);
  });

  it("keeps Phase 6B acquisition and snapshot transport independent from the Phase 6D mediator", async () => {
    const sixB = [
      ...await sourcesUnder("packages/repository-acquisition-network"),
      ...await sourcesUnder("packages/repository-snapshot"),
      ...await sourcesUnder("packages/repository-snapshot-network"),
    ];
    expect(sixB.filter(({ code }) => MEDIATOR_IMPORT.test(code)).map(({ file }) => file)).toEqual([]);
  });

  it("keeps Phase 6C zero-egress scanning independent from Phase 6D networking", async () => {
    const sixC = [
      ...await sourcesUnder("packages/hosted-scanner-runner"),
      ...await sourcesUnder("packages/scanner-core"),
      ...await sourcesUnder("packages/scanner-jsts"),
      ...await sourcesUnder("packages/scanner-iac"),
    ];
    expect(sixC.filter(({ code }) => MEDIATOR_IMPORT.test(code) || RUNTIME_NETWORK_IMPORT.test(code)).map(({ file }) => file)).toEqual([]);
  });

  it("does not expose a generic URL, fetch, HTTP, or proxy execution class in public worker contracts", async () => {
    const code = await source("packages/worker-contracts/types.ts");
    const executionUnion = code.match(/export type WorkerExecutionClass\s*=([\s\S]*?);/)?.[1] ?? "";
    expect(executionUnion.length).toBeGreaterThan(0);
    expect(executionUnion).not.toMatch(/generic|url|fetch|http|proxy/i);
  });

  it("permanently keeps both scanner and runtime executor sandboxes network-disabled", async () => {
    const scannerSandbox = await source("packages/worker-sandbox/podman-command.ts");
    const runtimeSandbox = await source("packages/runtime-worker-sandbox/podman-command.ts");
    expect(scannerSandbox).toContain("--network=none");
    expect(runtimeSandbox).toContain("--network=none");
  });
});
