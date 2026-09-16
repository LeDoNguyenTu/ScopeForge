import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const UNIT_PATH = "deploy/worker/scopeforge-worker@.service";

describe("worker systemd service", () => {
  it("uses a service-owned runtime directory without assuming a numeric uid", async () => {
    const unit = await readFile(UNIT_PATH, "utf8");

    expect(unit).not.toMatch(/\/run\/user\/\d+/);
    expect(unit).not.toContain("DBUS_SESSION_BUS_ADDRESS=");
    expect(unit).toContain("RuntimeDirectory=scopeforge-worker");
    expect(unit).toContain("RuntimeDirectoryMode=0700");
    expect(unit).toContain("Environment=XDG_RUNTIME_DIR=/run/scopeforge-worker");
    expect(unit).toContain(
      "ReadWritePaths=/var/lib/scopeforge /home/scopeforge-worker/.local/share/containers /run/scopeforge-worker",
    );
  });
});
