import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

async function source(file: string): Promise<string> {
  return readFile(path.resolve(file), "utf8");
}

function createTableSegment(sql: string, table: string): string {
  const start = sql.indexOf(`create table ${table}`);
  if (start < 0) return "";
  const end = sql.indexOf("\n);", start);
  return sql.slice(start, end < 0 ? sql.length : end + 3);
}

describe("Phase 10A3 webhook security architecture", () => {
  it("keeps browser read paths on the public repository-link model only", async () => {
    const readModel = await source("lib/project-scans/read-model.ts");
    const panel = await source("components/assets/ConnectedProjectScanPanel.tsx");
    const browserSource = `${readModel}\n${panel}`;

    expect(readModel).toContain('.from("github_repository_links")');
    expect(browserSource).not.toContain("github_webhook_deliveries");
    expect(browserSource).not.toContain("github_repository_auto_scan_state");
    expect(browserSource).not.toContain("trigger_delivery_id");
    expect(browserSource).not.toContain("trigger_commit_sha");
  });

  it("does not use browser session auth as the webhook trust boundary", async () => {
    const route = await source("app/api/integrations/github/webhook/route.ts");
    const service = await source("lib/github-app/webhook-service.ts");
    const reconciliation = await source("lib/project-scans/automatic-reconciliation.ts");
    const trustedSource = `${route}\n${service}\n${reconciliation}`;

    expect(trustedSource).not.toContain("@/lib/supabase/server");
    expect(trustedSource).not.toContain("auth.getUser");
    expect(trustedSource).not.toContain("workspace_members");
    expect(route).toContain("readGitHubWebhookRequest");
    expect(service).toContain("createAdminClient");
    expect(reconciliation).toContain("createAdminClient");
  });

  it("persists no webhook credential, signature, raw payload, or source capability columns", async () => {
    const sql = await source("supabase/migrations/20260912020000_phase_10a3_github_webhook_reconciliation.sql");
    const deliveryTable = createTableSegment(sql, "private.github_webhook_deliveries");
    const autoScanTable = createTableSegment(sql, "private.github_repository_auto_scan_state");
    expect(deliveryTable).not.toBe("");
    expect(autoScanTable).not.toBe("");

    for (const segment of [deliveryTable, autoScanTable]) {
      for (const forbiddenColumn of [
        "token",
        "secret",
        "signature",
        "raw_payload",
        "archive_url",
        "authorization",
        "source_body",
      ]) {
        expect(segment).not.toMatch(new RegExp(`^\\s*${forbiddenColumn}\\s+`, "im"));
      }
    }
  });

  it("keeps webhook and completion RPC authority service-role-only", async () => {
    const base = await source("supabase/migrations/20260912020000_phase_10a3_github_webhook_reconciliation.sql");
    const completion = await source("supabase/migrations/20260912022000_phase_10a3_completion_reconciliation.sql");
    const sql = `${base}\n${completion}`.replace(/\s+/g, " ");

    for (const fn of [
      "admit_github_webhook_delivery",
      "record_github_webhook_push_head",
      "enqueue_github_webhook_project_snapshot",
      "complete_github_webhook_project_scan",
    ]) {
      expect(sql).toMatch(new RegExp(`revoke all on function public\\.${fn}\\([^;]+\\) from public, anon, authenticated, service_role`));
      expect(sql).toMatch(new RegExp(`grant execute on function public\\.${fn}\\([^;]+\\) to service_role`));
    }
  });
});
