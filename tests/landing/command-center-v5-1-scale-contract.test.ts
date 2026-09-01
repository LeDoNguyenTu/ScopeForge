import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = [
  readFileSync(join(process.cwd(), "app/command-center-v5.css"), "utf8"),
  readFileSync(join(process.cwd(), "app/command-center-v5-1.css"), "utf8"),
  readFileSync(join(process.cwd(), "app/command-center-v5-2.css"), "utf8"),
].join("\n");

function pxVariable(name: string): number {
  const match = css.match(new RegExp(`${name}\\s*:\\s*([0-9.]+)px`));
  if (!match) throw new Error(`Missing V5.2 scale contract variable ${name}`);
  return Number(match[1]);
}

describe("Command Center V5.2 harmony contract", () => {
  it("keeps metric typography readable without allowing oversized mobile values", () => {
    expect(pxVariable("--cc-v52-metric-value")).toBeGreaterThanOrEqual(32);
    expect(pxVariable("--cc-v52-metric-value")).toBeLessThanOrEqual(36);
    expect(pxVariable("--cc-v52-metric-label")).toBeGreaterThanOrEqual(14);
    expect(pxVariable("--cc-v52-metric-icon")).toBeGreaterThanOrEqual(24);
    expect(pxVariable("--cc-v52-metric-supporting")).toBeGreaterThanOrEqual(12);
  });

  it("raises the workflow chain to the same visual hierarchy as the hero", () => {
    expect(pxVariable("--cc-v52-workflow-title")).toBeGreaterThanOrEqual(20);
    expect(pxVariable("--cc-v52-workflow-body")).toBeGreaterThanOrEqual(15);
    expect(pxVariable("--cc-v52-workflow-step")).toBeGreaterThanOrEqual(11);
    expect(pxVariable("--cc-v52-workflow-icon")).toBeGreaterThanOrEqual(24);
    expect(pxVariable("--cc-v52-security-card-title")).toBeGreaterThanOrEqual(17);
    expect(pxVariable("--cc-v52-security-card-body")).toBeGreaterThanOrEqual(14);
  });

  it("optically centers metric content instead of offsetting it with absolute icons", () => {
    expect(css).toContain(".ccV5MetricCard");
    expect(css).toContain("grid-template-columns: auto auto");
    expect(css).toContain("justify-content: center");
    expect(css).toContain(".forgeWorkflowGrid");
    expect(css).toContain("grid-template-columns: repeat(4, minmax(0, 1fr))");
  });
});
