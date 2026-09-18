import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const orchestrationFiles = [
  "lib/pentest-runs/create-run.ts",
  "lib/pentest-runs/advance-run.ts",
  "lib/pentest-runs/cancel-run.ts",
  "lib/pentest-runs/approve-action.ts",
  "lib/pentest-runs/read-model.ts",
  "lib/pentest-runs/repository.ts",
];

describe("Phase 11 run orchestration authority boundary", () => {
  it("keeps provider, process, network, and worker credentials outside the control plane", async () => {
    const source = (await Promise.all(
      orchestrationFiles.map((file) => readFile(path.resolve(process.cwd(), file), "utf8")),
    )).join("\n");

    for (const forbidden of [
      /packages\/capability-registry\/types/,
      /provider-nmap/i,
      /provider-nuclei/i,
      /provider-http-discovery/i,
      /child_process/,
      /node:https/,
      /node:http/,
      /\bfetch\s*\(/,
      /service[_-]?role[_-]?key/i,
      /worker[_-]?credential/i,
      /\.execute\s*\(/,
    ]) {
      expect(source).not.toMatch(forbidden);
    }

    expect(source).toContain("planNextIteration");
    expect(source).toContain("evaluateActionPolicy");
    expect(source).toContain("enqueueApprovedAction");
    expect(source).toContain("cancelQueuedAction");
  });
});
