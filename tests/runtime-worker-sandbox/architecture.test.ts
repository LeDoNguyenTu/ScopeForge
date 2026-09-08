import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const commandPath = path.resolve("packages/runtime-worker-sandbox/podman-command.ts");
const clientPath = path.resolve("packages/runtime-worker-mediator/unix-client.ts");
const serverPath = path.resolve("packages/runtime-worker-mediator/unix-server.ts");

describe("Phase 6D runtime sandbox architecture", () => {
  it("uses argv construction only and never invokes a shell", async () => {
    const source = await readFile(commandPath, "utf8");
    expect(source).not.toMatch(/exec\(|execSync|spawn\(|shell\s*:/);
    expect(source).not.toContain("--privileged");
    expect(source).not.toContain("--device");
    expect(source).not.toContain("docker.sock");
    expect(source).not.toContain("podman.sock");
    expect(source).toContain('"--network=none"');
  });

  it("uses Unix sockets only and has no localhost TCP dependency", async () => {
    const [client, server] = await Promise.all([
      readFile(clientPath, "utf8"),
      readFile(serverPath, "utf8"),
    ]);
    const source = `${client}\n${server}`;
    expect(source).toContain("node:net");
    expect(source).not.toMatch(/127[.]0[.]0[.]1|localhost|listen\(\s*\d|port\s*:/i);
    expect(source).not.toMatch(/console[.]|logger|session\.nonce/);
  });
});
