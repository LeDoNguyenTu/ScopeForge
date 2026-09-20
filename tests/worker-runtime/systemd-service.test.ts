import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const UNIT_PATH = "deploy/worker/scopeforge-worker@.service";
const MEDIATOR_PATH = "packages/runtime-worker-mediator/unix-server.ts";
const PODMAN_PATH = "packages/runtime-worker-sandbox/podman-command.ts";

describe("worker systemd service", () => {
  it("uses a service-owned runtime directory without assuming a numeric uid", async () => {
    const [unit, mediator, podman] = await Promise.all([
      readFile(UNIT_PATH, "utf8"),
      readFile(MEDIATOR_PATH, "utf8"),
      readFile(PODMAN_PATH, "utf8"),
    ]);

    expect(unit).not.toMatch(/\/run\/user\/\d+/);
    expect(unit).not.toContain("DBUS_SESSION_BUS_ADDRESS=");
    expect(unit).toContain("RuntimeDirectory=scopeforge-worker");
    expect(unit).toContain("RuntimeDirectoryPreserve=yes");
    expect(unit).toContain("RuntimeDirectoryMode=0700");
    expect(unit).toContain("Environment=XDG_RUNTIME_DIR=/run/scopeforge-worker");
    expect(unit).toContain(
      "ReadWritePaths=/var/lib/scopeforge /home/scopeforge-worker/.local/share/containers /run/scopeforge-worker",
    );
    expect(mediator).toContain("/run/scopeforge-worker/runtime-mediator");
    expect(podman).toContain("/run/scopeforge-worker/runtime-mediator");
    expect(mediator).not.toContain("/run/scopeforge/runtime-mediator");
    expect(podman).not.toContain("/run/scopeforge/runtime-mediator");
  });
});
