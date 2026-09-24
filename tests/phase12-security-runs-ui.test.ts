import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("workspace security run UI", () => {
  it("renders real read-model history and separates provider readiness from run state", async () => {
    const page = await readFile("app/dashboard/security-runs/page.tsx", "utf8");
    expect(page).toContain("listPentestRunSummaries");
    expect(page).toContain("PROVIDER_RUNTIME_READINESS");
    expect(page).toContain("External enabled");
    expect(page).toContain("Authorization first");
    expect(page).not.toContain("launchPhase11");
    expect(page).not.toContain("enableProvider");
  });

  it("renders bounded public run evidence without raw private evidence access", async () => {
    const page = await readFile("app/dashboard/security-runs/[runId]/page.tsx", "utf8");
    expect(page).toContain("loadPentestRunReadModel");
    expect(page).toContain("Capabilities attempted");
    expect(page).toContain("Provider failures");
    expect(page).toContain("Normalized evidence");
    expect(page).not.toContain("createAdminClient");
    expect(page).not.toContain("security_evidence");
    expect(page).not.toContain("private.");
  });

  it("keeps workspace navigation responsive after adding the new destination", async () => {
    const css = await readFile("app/ui-refinement.css", "utf8");
    expect(css).toContain(".immersiveDashboardLinks { min-width: 0;");
    expect(css).toContain("overflow-x: auto");
    expect(css).toContain(".immersiveDashboardLinks .sideLink { flex: 0 0 auto;");
  });
});
