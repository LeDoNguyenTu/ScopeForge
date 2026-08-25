import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repositoryPath = path.resolve(process.cwd(), "lib/security-findings/repository.ts");
const listPagePath = path.resolve(process.cwd(), "app/dashboard/findings/page.tsx");
const detailPagePath = path.resolve(process.cwd(), "app/dashboard/findings/[findingId]/page.tsx");
const dashboardPagePath = path.resolve(process.cwd(), "app/dashboard/page.tsx");

describe("hosted findings read model", () => {
  it("lists findings inside one workspace ordered by newest observation", async () => {
    const source = await readFile(repositoryPath, "utf8");
    const listStart = source.indexOf("async function listWorkspaceFindings");
    const detailStart = source.indexOf("async function loadWorkspaceFindingDetail");

    expect(listStart).toBeGreaterThanOrEqual(0);
    expect(detailStart).toBeGreaterThan(listStart);
    const listSource = source.slice(listStart, detailStart);
    expect(listSource).toContain('.from("security_findings")');
    expect(listSource).toContain('.eq("workspace_id", workspaceId)');
    expect(listSource).toContain('.order("last_seen_at", { ascending: false })');
  });

  it("workspace-scopes the finding, links, evidence, occurrence, and event detail queries", async () => {
    const source = await readFile(repositoryPath, "utf8");
    const detailStart = source.indexOf("async function loadWorkspaceFindingDetail");
    const mutationStart = source.indexOf("async function changeLifecycle");

    expect(detailStart).toBeGreaterThanOrEqual(0);
    expect(mutationStart).toBeGreaterThan(detailStart);
    const detailSource = source.slice(detailStart, mutationStart);
    for (const table of [
      "security_findings",
      "security_finding_evidence",
      "security_evidence",
      "security_finding_occurrences",
      "security_finding_events",
    ]) {
      expect(detailSource).toContain(`.from("${table}")`);
    }
    expect(detailSource.match(/\.eq\("workspace_id", workspaceId\)/g)?.length ?? 0).toBeGreaterThanOrEqual(5);
    expect(detailSource.match(/\.eq\("finding_id", findingId\)/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
  });

  it("bounds list and detail history reads", async () => {
    const source = await readFile(repositoryPath, "utf8");
    const listStart = source.indexOf("async function listWorkspaceFindings");
    const detailStart = source.indexOf("async function loadWorkspaceFindingDetail");
    const mutationStart = source.indexOf("async function changeLifecycle");

    const listSource = source.slice(listStart, detailStart);
    const detailSource = source.slice(detailStart, mutationStart);
    expect(listSource).toContain(".limit(100)");
    expect(detailSource.match(/\.limit\(100\)/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
  });

  it("uses a count-only dashboard query instead of materializing the finding ledger", async () => {
    const source = await readFile(dashboardPagePath, "utf8");

    expect(source).toContain('count: "exact"');
    expect(source).toContain("head: true");
    expect(source).not.toContain('.select("finding_id,lifecycle_state")');
  });

  it("uses the authenticated dashboard client for SELECT-only list and detail pages", async () => {
    const [listPage, detailPage] = await Promise.all([
      readFile(listPagePath, "utf8"),
      readFile(detailPagePath, "utf8"),
    ]);

    for (const source of [listPage, detailPage]) {
      expect(source).toContain("getDashboardContext");
      expect(source).toContain("createSecurityFindingRepository");
      expect(source).not.toContain("createAdminClient");
    }
  });
});
