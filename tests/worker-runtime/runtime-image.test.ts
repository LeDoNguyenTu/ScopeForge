import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("runtime worker image candidate", () => {
  it("builds the fixed runtime container entry as a standalone worker artifact", async () => {
    const build = await readFile("scripts/build-workers.mjs", "utf8");
    expect(build).toContain('entryPoints: ["packages/runtime-worker-runner/container-entry.ts"]');
    expect(build).toContain('outfile: `${outdir}/runtime-worker-entry.js`');
  });

  it("pins a non-root runtime image to the reviewed Node base digest", async () => {
    const containerfile = await readFile("deploy/worker/Containerfile.runtime", "utf8");
    expect(containerfile).toContain(
      "FROM docker.io/library/node@sha256:2c87ef9bd3c6a3bd4b472b4bec2ce9d16354b0c574f736c476489d09f560a203",
    );
    expect(containerfile).toContain(
      "COPY --chown=65532:65532 runtime-worker-entry.js /app/runtime-worker-entry.js",
    );
    expect(containerfile).toContain("USER 65532:65532");
    expect(containerfile).toContain(
      'ENTRYPOINT ["/usr/local/bin/node", "/app/runtime-worker-entry.js"]',
    );
    expect(containerfile).not.toMatch(/\b(?:RUN|ADD)\b/);
    expect(containerfile).not.toMatch(/https?:\/\//);
  });

  it("matches the immutable Podman sandbox entry path and wires only explicit hosted runtime authority", async () => {
    const [command, config, entry] = await Promise.all([
      readFile("packages/runtime-worker-sandbox/podman-command.ts", "utf8"),
      readFile("packages/worker-runtime/config.ts", "utf8"),
      readFile("packages/worker-runtime/entry.ts", "utf8"),
    ]);
    expect(command).toContain('"/app/runtime-worker-entry.js"');
    expect(command).toContain('"--pull=never"');
    expect(command).toContain('"--network=none"');
    expect(command).toContain('"--read-only"');
    expect(command).toContain('"--cap-drop=all"');
    expect(command).toContain('"--security-opt=no-new-privileges"');

    const configUnion = config.match(/export type WorkerRuntimeConfig =([\s\S]*?);\r?\n\r?\nfunction required/)?.[1] ?? "";
    expect(configUnion).toContain("phase11_http_discovery_v1");
    expect(configUnion).toContain("runtimeImage: string");
    expect(entry).toContain("createRuntimeWorkerExecutor");
    expect(entry).toContain("createRuntimeNetworkPreparer");
    expect(entry).toContain("runtimeNetworkPreparer");
  });
});
