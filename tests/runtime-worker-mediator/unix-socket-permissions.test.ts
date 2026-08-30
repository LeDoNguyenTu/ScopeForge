import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const serverPath = path.resolve("packages/runtime-worker-mediator/unix-server.ts");

describe("runtime mediator socket permissions", () => {
  it("keeps the host directory private while allowing the bind-mounted executor to connect", async () => {
    const source = await readFile(serverPath, "utf8");
    expect(source).toContain("mode: 0o700");
    expect(source).toContain("chmod(socketPath, 0o666)");
  });
});
