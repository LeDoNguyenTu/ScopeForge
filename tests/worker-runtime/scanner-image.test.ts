import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("hosted scanner image layout", () => {
  it("matches the sandbox entrypoint and bundled HCL parser asset path", async () => {
    const containerfile = await readFile(
      "deploy/worker/Containerfile.scanner",
      "utf8",
    );
    const sandbox = await readFile(
      "packages/worker-sandbox/podman-command.ts",
      "utf8",
    );

    expect(sandbox).toContain('"/app/hosted-scanner-entry.js"');
    expect(containerfile).toContain(
      "COPY --chown=65532:65532 hosted-scanner-entry.js /app/hosted-scanner-entry.js",
    );
    expect(containerfile).toContain(
      "COPY --chown=65532:65532 main.wasm.gz /main.wasm.gz",
    );
  });
});
