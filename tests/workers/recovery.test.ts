import { describe, expect, it, vi } from "vitest";
import { recoverExpiredWorkerAttempts } from "@/lib/worker-control/recovery";

describe("worker recovery entry point", () => {
  it("delegates authoritative recovery to one database transaction", async () => {
    const recover = vi.fn(async () => 2);
    await expect(recoverExpiredWorkerAttempts({
      recover,
      now: () => new Date("2026-08-26T00:00:00.000Z"),
    })).resolves.toBe(2);
    expect(recover).toHaveBeenCalledWith("2026-08-26T00:00:00.000Z");
  });

  it("never loops or retries recovery in application code", async () => {
    const recover = vi.fn(async () => 0);
    await recoverExpiredWorkerAttempts({ recover });
    expect(recover).toHaveBeenCalledTimes(1);
  });
});
