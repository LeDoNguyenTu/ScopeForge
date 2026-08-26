import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const routePaths = {
  claim: path.resolve(process.cwd(), "app/api/internal/workers/claim/route.ts"),
  heartbeat: path.resolve(process.cwd(), "app/api/internal/workers/heartbeat/route.ts"),
  finalize: path.resolve(process.cwd(), "app/api/internal/workers/finalize/route.ts"),
};
const transportPath = path.resolve(process.cwd(), "lib/worker-control/transport.ts");

describe("worker broker routes", () => {
  it("keeps the claim route body-free and derives authority from worker authentication", async () => {
    const source = await readFile(routePaths.claim, "utf8");
    expect(source).toContain("authenticateWorkerRequest");
    expect(source).toContain("assertNoWorkerRequestBody");
    expect(source).toContain("claimWorkerTask");
    expect(source).not.toContain("executionClass");
    expect(source).not.toContain("createClient");
  });

  it("uses the shared 64 KiB bounded JSON transport for heartbeat and finalize", async () => {
    const [heartbeat, finalize, transport] = await Promise.all([
      readFile(routePaths.heartbeat, "utf8"),
      readFile(routePaths.finalize, "utf8"),
      readFile(transportPath, "utf8"),
    ]);
    expect(transport).toContain("65_536");
    expect(transport).toContain("WORKER_REQUEST_TOO_LARGE");
    expect(heartbeat).toContain("readBoundedWorkerJson");
    expect(finalize).toContain("readBoundedWorkerJson");
  });

  it("does not expose worker-selected execution or network configuration", async () => {
    const sources = await Promise.all(Object.values(routePaths).map((file) => readFile(file, "utf8")));
    const combined = sources.join("\n");
    for (const forbidden of [
      "command",
      "containerName",
      "networkAllowlist",
      "packageManager",
      "requestHeaders",
      "requestBody",
      "lifecycleState",
      "validationState",
    ]) {
      expect(combined).not.toContain(forbidden);
    }
  });
});
