import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("workspace security run UI", () => {
  it("renders real read-model history and separates provider readiness from run state", async () => {
    const page = await readFile("app/dashboard/security-runs/page.tsx", "utf8");
    expect(page).toContain("listPentestRunSummaries");
    expect(page).toContain("PROVIDER_RUNTIME_READINESS");
    expect(page).toContain("External enabled");
    expect(page).toContain("Authorization first");
    expect(page).toContain("What ScopeForge can execute now");
    expect(page).toContain("CapabilityRoadmap");
    expect(page).toContain("ProviderRuntimeCard");
    expect(page).not.toContain("launchPhase11");
    expect(page).not.toContain("enableProvider");
  });

  it("renders bounded public run evidence as an end-to-end run journey without raw private evidence", async () => {
    const page = await readFile("app/dashboard/security-runs/[runId]/page.tsx", "utf8");
    const journey = await readFile("components/security-runs/RunJourney.tsx", "utf8");
    expect(page).toContain("loadPentestRunReadModel");
    expect(page).toContain("Capabilities attempted");
    expect(page).toContain("Provider failures");
    expect(page).toContain("Normalized evidence");
    expect(page).toContain("RunJourney");
    expect(journey).toContain("Scope authorized");
    expect(journey).toContain("Actions planned");
    expect(journey).toContain("Coverage executed");
    expect(journey).toContain("Evidence reduced");
    expect(page).not.toContain("createAdminClient");
    expect(page).not.toContain("security_evidence");
    expect(page).not.toContain("private.");
  });

  it("presents provider gate truth and the complete Phase 12 roadmap without adding execution authority", async () => {
    const card = await readFile("components/security-runs/ProviderRuntimeCard.tsx", "utf8");
    const roadmap = await readFile("components/security-runs/CapabilityRoadmap.tsx", "utf8");
    const readiness = await readFile("lib/provider-runtime/readiness.ts", "utf8");
    expect(card).toContain("Acceptance gates");
    expect(card).toContain("Next release gate");
    expect(card).toContain("Locked for validation");
    for (const slice of ["12A", "12B", "12C", "12D", "12E", "12F", "12G", "12H"]) {
      expect(readiness).toContain(`slice: "${slice}"`);
    }
    expect(roadmap).toContain("Automated pentest capability roadmap");
    expect(card).not.toContain("enableProvider");
    expect(roadmap).not.toContain("Run provider");
  });

  it("keeps workspace navigation and the new roadmap responsive", async () => {
    const shellCss = await readFile("app/ui-refinement.css", "utf8");
    const css = await readFile("app/dashboard/security-runs/security-runs.module.css", "utf8");
    expect(shellCss).toContain(".immersiveDashboardLinks { min-width: 0;");
    expect(shellCss).toContain("overflow-x: auto");
    expect(css).toContain(".roadmapGrid");
    expect(css).toContain("@media (max-width: 520px)");
    expect(css).toContain(".journey");
  });
});
