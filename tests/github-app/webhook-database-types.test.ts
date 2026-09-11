import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const typePath = path.resolve("lib/database.phase10a3.types.ts");

async function typeSource(): Promise<string> {
  return existsSync(typePath) ? readFile(typePath, "utf8") : "";
}

const webhookRpcs = [
  "admit_github_webhook_delivery",
  "get_github_webhook_repository_context",
  "record_github_webhook_push_head",
  "enqueue_github_webhook_project_snapshot",
  "record_github_webhook_delivery_result",
  "reconcile_github_webhook_connection_state",
  "reconcile_github_webhook_repository_state",
  "complete_github_webhook_project_scan",
] as const;

describe("Phase 10A3 database type overlay", () => {
  it("composes the validated Phase 10A2 surface instead of replacing earlier RPCs", async () => {
    const source = await typeSource();
    expect(source).toContain('import type { Phase10a2Database } from "./database.phase10a2.types";');
    expect(source).toContain('Phase10a2Database["public"]["Functions"]');
    expect(source).toContain("export type Phase10a3Functions");
    expect(source).toContain("export type Phase10a3Database");
  });

  it("types every webhook reconciliation RPC with explicit Args and Json returns", async () => {
    const source = await typeSource();
    for (const fn of webhookRpcs) {
      expect(source, `missing typed RPC ${fn}`).toContain(`${fn}:`);
    }
    expect(source.match(/Returns:\s*Json;/g)?.length ?? 0).toBeGreaterThanOrEqual(webhookRpcs.length);
  });

  it("keeps private webhook persistence tables out of the browser database surface", async () => {
    const source = await typeSource();
    expect(source).not.toMatch(/^\s{6}github_webhook_deliveries:\s*\{/m);
    expect(source).not.toMatch(/^\s{6}github_repository_auto_scan_state:\s*\{/m);
  });
});
