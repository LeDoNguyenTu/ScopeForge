import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

async function source(relativePath: string): Promise<string> {
  return readFile(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("Phase 11C HTTP discovery runtime authority", () => {
  it("keeps the provider adapter free of process and network authority", async () => {
    const code = await source("packages/provider-http-discovery/index.ts");
    for (const forbidden of [
      /node:child_process/,
      /node:net/,
      /node:https/,
      /node:http/,
      /node:dns/,
      /\bfetch\s*\(/,
      /execFile\s*\(/,
      /spawn\s*\(/,
    ]) {
      expect(code).not.toMatch(forbidden);
    }
  });

  it("keeps the mediator route set code-owned and closed", async () => {
    const code = await source("packages/runtime-worker-mediator/http-discovery.ts");
    expect(code).toContain('["root", "/"]');
    expect(code).toContain('["security-txt", "/.well-known/security.txt"]');
    expect(code).toContain('["robots", "/robots.txt"]');
    expect(code).toContain('["sitemap", "/sitemap.xml"]');
    expect(code).toContain("const MAX_REQUESTS = 12");
    expect(code).toContain('executionClass: "phase11_http_discovery_v1"');

    const profile = code.match(/export interface HttpDiscoveryMediatorProfile \{([\s\S]*?)\n\}/)?.[1] ?? "";
    expect(profile).not.toMatch(/\b(url|path|headers|body|proxy|command|argv|host|port)\??\s*:/i);
  });

  it("keeps the executor networkless and mediator-only", async () => {
    const command = await source("packages/runtime-worker-sandbox/podman-command.ts");
    expect(command).toContain('"--network=none"');
    expect(command).toContain('"--read-only"');
    expect(command).toContain('"--cap-drop=all"');
    expect(command).toContain('"--security-opt=no-new-privileges"');
    expect(command).toContain('"--pids-limit=8"');
    expect(command).toContain("RUNTIME_MEDIATOR_CONTAINER_SOCKET_PATH");
    expect(command).not.toMatch(/--network=host|--privileged|docker[.]sock|podman[.]sock/);
  });

  it("allows the reviewed class through explicit immutable hosted runtime configuration", async () => {
    const workerTypes = await source("packages/worker-contracts/types.ts");
    const workerUnion = workerTypes.match(/export type WorkerExecutionClass\s*=([\s\S]*?);/)?.[1] ?? "";
    expect(workerUnion).toContain("phase11_http_discovery_v1");

    const runtimeConfig = await source("packages/worker-runtime/config.ts");
    expect(runtimeConfig).toContain('executionClass: "phase11_http_discovery_v1"');
    expect(runtimeConfig).toContain('required(env, "SCOPEFORGE_RUNTIME_IMAGE")');

    const environment = await source("docs/ENVIRONMENT.md");
    expect(environment).toContain("SCOPEFORGE_RUNTIME_IMAGE");
    expect(environment).toContain("phase11_http_discovery_v1");
  });
});
