import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const typesPath = path.resolve(process.cwd(), "lib/database.types.ts");

describe("Phase 6A database type contract", () => {
  it("includes the internal worker probe job kind and intended service-role RPC surface", async () => {
    const source = await readFile(typesPath, "utf8");

    expect(source).toContain('"worker_foundation_probe"');
    for (const fn of [
      "register_worker_node",
      "disable_worker_node",
      "authenticate_worker_node",
      "enqueue_foundation_worker_task",
      "claim_worker_task",
      "heartbeat_worker_attempt",
      "finalize_worker_attempt",
      "recover_expired_worker_attempts",
      "get_worker_fleet_snapshot",
    ]) {
      expect(source).toContain(`${fn}: {`);
    }
  });

  it("does not advertise internal recovery helpers to application code", async () => {
    const source = await readFile(typesPath, "utf8");
    expect(source).not.toContain("recover_worker_state: {");
    expect(source).not.toContain("recover_expired_worker_attempts_leased_only: {");
  });
});
