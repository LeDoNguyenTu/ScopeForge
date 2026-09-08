import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const telemetryPath = "lib/security/telemetry.ts";
const httpResponsePath = "lib/worker-control/http-response.ts";
const nextConfigPath = "next.config.ts";
const packagePath = "package.json";
const operationsPath = "docs/security/PHASE_9D_TELEMETRY_AND_CSP.md";

async function read(file: string): Promise<string> {
  return readFile(file, "utf8");
}

async function sourceFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const candidate = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFiles(candidate));
    else if (/\.(?:ts|tsx)$/.test(entry.name)) files.push(candidate);
  }
  return files;
}

describe("Phase 9D security telemetry and browser hardening", () => {
  it("keeps a closed bounded security telemetry surface", async () => {
    const telemetry = await read(telemetryPath);
    for (const required of [
      "scopeforge.security.v1",
      "worker.authentication_rejected",
      "worker.access_rejected",
      "worker.rate_limited",
      "worker.request_failed",
      "security.control_misconfigured",
      "MAX_SERIALIZED_BYTES = 1024",
    ]) {
      expect(telemetry).toContain(required);
    }
    expect(telemetry).toContain("writeSecurityTelemetry(event: SecurityTelemetryEvent)");
    expect(telemetry).not.toMatch(/export\s+(?:type|interface)\s+\w+[^\n]*Record<string,\s*unknown>/);
    expect(telemetry).not.toMatch(/\bmetadata\??\s*:|\bdetails\??\s*:|\bmessage\??\s*:|\bheaders\??\s*:|\bbody\??\s*:/);
  });

  it("keeps telemetry out of client components", async () => {
    const files = [
      ...await sourceFiles("app"),
      ...await sourceFiles("components"),
      ...await sourceFiles("lib"),
    ];
    const importers: string[] = [];
    for (const file of files) {
      if (file === telemetryPath) continue;
      const source = await read(file);
      if (source.includes("@/lib/security/telemetry")) importers.push(file.replaceAll("\\", "/"));
    }
    expect(importers).toEqual([httpResponsePath]);
    expect(await read(telemetryPath)).toContain('typeof window !== "undefined"');
  });

  it("pins the released browser security header baseline without claiming CSP", async () => {
    const config = await read(nextConfigPath);
    expect(config).toContain('{ key: "X-Content-Type-Options", value: "nosniff" }');
    expect(config).toContain('{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }');
    expect(config).toContain('{ key: "X-Frame-Options", value: "DENY" }');
    expect(config).toContain('camera=(), microphone=(), geolocation=(), payment=(), usb=()');
    expect(config).toContain('max-age=63072000; includeSubDomains; preload');
    expect(config).toContain("poweredByHeader: false");
    expect(config).not.toContain("Content-Security-Policy");
  });

  it("adds no telemetry SDK or log-store dependency", async () => {
    const packageJson = JSON.parse(await read(packagePath)) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const names = [
      ...Object.keys(packageJson.dependencies ?? {}),
      ...Object.keys(packageJson.devDependencies ?? {}),
    ].join("\n");
    expect(names).not.toMatch(/sentry|datadog|pino|winston|opentelemetry|logtail|axiom/i);
  });

  it("records alert thresholds and the non-enforced CSP boundary", async () => {
    const operations = await read(operationsPath);
    expect(operations).toMatch(/worker\.authentication_rejected[\s\S]*10[\s\S]*5 minutes/i);
    expect(operations).toMatch(/worker\.request_failed[\s\S]*3[\s\S]*5 minutes/i);
    expect(operations).toMatch(/worker\.rate_limited[\s\S]*20[\s\S]*10 minutes/i);
    expect(operations).toMatch(/security\.control_misconfigured[\s\S]*any production occurrence/i);
    expect(operations).toMatch(/CSP state:\s*NOT ENFORCED/i);
    expect(operations).toMatch(/Vercel automated alert state:\s*NOT CLAIMED/i);
  });

  it("does not widen hosted worker runtime authority", async () => {
    const source = `${await read(telemetryPath)}\n${await read(httpResponsePath)}`;
    expect(source).not.toMatch(/HOSTED_(?:REPOSITORY|PASSIVE|ACTIVE)/i);
  });
});
