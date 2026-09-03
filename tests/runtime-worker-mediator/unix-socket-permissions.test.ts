import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const serverPath = path.resolve("packages/runtime-worker-mediator/unix-server.ts");

describe("runtime mediator socket permissions", () => {
  it("re-establishes a private supervisor-owned host root before exposing the bind-mounted socket", async () => {
    const source = await readFile(serverPath, "utf8");

    expect(source).toContain("lstat(RUNTIME_MEDIATOR_HOST_SOCKET_ROOT)");
    expect(source).toContain("rootStats.isSymbolicLink()");
    expect(source).toContain("rootStats.isDirectory()");
    expect(source).toContain("rootStats.uid !== process.getuid()");
    expect(source).toContain("chmod(RUNTIME_MEDIATOR_HOST_SOCKET_ROOT, 0o700)");
    expect(source).toContain("chmod(socketPath, 0o666)");
  });

  it("makes a listening server reachable by cleanup before socket permission publication can fail", async () => {
    const source = await readFile(serverPath, "utf8");
    const assigned = source.indexOf("server = nextServer");
    const socketMode = source.indexOf("await chmod(socketPath, 0o666)");

    expect(assigned).toBeGreaterThan(-1);
    expect(socketMode).toBeGreaterThan(assigned);
    expect(source).toContain("await close();");
  });
});
