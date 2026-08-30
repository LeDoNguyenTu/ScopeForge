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
  it("keeps external network ownership inside runtime-network and runtime-worker-mediator", async () => {
    const roots = ["app", "lib", "packages"];
    const all = (await Promise.all(roots.map(sourcesUnder))).flat();
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
    const forbidden = /(?:supabase|database|repository-snapshots|cloudflare|\br2\b|github|scanner|openai|anthropic|gemini|playwright|puppeteer|child_process|child-process|node:vm|["']vm["']|worker_threads|worker-threads)/i;
    const offenders = files.filter(({ code }) => forbidden.test(code));
    expect(offenders.map(({ file }) => file)).toEqual([]);
  });

  it("keeps Phase 6B acquisition and Phase 6C zero-egress scanning independent from Phase 6D networking", async () => {
    const sixB = await sourcesUnder("packages/repository-snapshot-worker").catch(() => []);
    const sixC = await sourcesUnder("packages/repository-scan-worker").catch(() => []);
    expect(sixB.filter(({ code }) => MEDIATOR_IMPORT.test(code)).map(({ file }) => file)).toEqual([]);
    expect(sixC.filter(({ code }) => MEDIATOR_IMPORT.test(code) || RUNTIME_NETWORK_IMPORT.test(code)).map(({ file }) => file)).toEqual([]);
  });

  it("does not expose a generic URL, fetch, HTTP, or proxy execution class in public worker contracts", async () => {
    const code = await source("packages/worker-contracts/index.ts");
    const executionUnion = code.match(/export type WorkerExecutionClass\s*=([\s\S]*?);/)?.[1] ?? "";
    expect(executionUnion).not.toMatch(/generic|url|fetch|http|proxy/i);
  });

  it("permanently keeps the general executor sandbox network-disabled", async () => {
    const files = await sourcesUnder("packages/worker-supervisor");
    const combined = files.map(({ code }) => code).join("\n");
    expect(combined).toContain("--network=none");
  });
});
