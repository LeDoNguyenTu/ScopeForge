import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const executorPath = path.resolve("packages/worker-supervisor/executor.ts");
const runtimePath = path.resolve("packages/worker-supervisor/runtime-network.ts");

describe("Phase 6D executor architecture", () => {
  it("keeps raw network authority out of executor dispatch", async () => {
    const executor = await readFile(executorPath, "utf8");
    for (const forbidden of [
      "node:http",
      "node:https",
      "node:net",
      "node:tls",
      "node:dns",
      "packages/runtime-network",
      "requestPinnedHttps",
      "fetch(",
    ]) {
      expect(executor).not.toContain(forbidden);
    }
  });

  it("keeps preparation and mediator lifecycle supervisor-owned", async () => {
    const source = await readFile(runtimePath, "utf8");
    expect(source).toContain("createRuntimeMediatorSessionRegistry");
    expect(source).toContain("createRuntimeMediatorUnixServer");
    expect(source).not.toContain("service_role");
    expect(source).not.toContain("createAdminClient");
  });
});
