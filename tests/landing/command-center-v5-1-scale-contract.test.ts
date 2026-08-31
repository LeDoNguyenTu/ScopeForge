import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "app/command-center-v5.css"), "utf8");

function pxVariable(name: string): number {
  const match = css.match(new RegExp(`${name}\\s*:\\s*([0-9.]+)px`));
  if (!match) throw new Error(`Missing V5.1 scale contract variable ${name}`);
  return Number(match[1]);
}

describe("Command Center V5.1 readability contract", () => {
  it("keeps desktop telemetry at product-grade readable sizes", () => {
    expect(pxVariable("--cc-v51-metric-value-desktop")).toBeGreaterThanOrEqual(32);
    expect(pxVariable("--cc-v51-metric-label-desktop")).toBeGreaterThanOrEqual(13);
    expect(pxVariable("--cc-v51-metric-icon")).toBeGreaterThanOrEqual(24);
    expect(pxVariable("--cc-v51-runtime-value")).toBeGreaterThanOrEqual(13);
    expect(pxVariable("--cc-v51-overview-label")).toBeGreaterThanOrEqual(13);
    expect(pxVariable("--cc-v51-risk-copy")).toBeGreaterThanOrEqual(12);
  });

  it("keeps mobile telemetry larger instead of shrinking the desktop dashboard", () => {
    expect(pxVariable("--cc-v51-metric-value-mobile")).toBeGreaterThanOrEqual(34);
    expect(pxVariable("--cc-v51-metric-label-mobile")).toBeGreaterThanOrEqual(14);
    expect(pxVariable("--cc-v51-supporting-mobile")).toBeGreaterThanOrEqual(12);
    expect(pxVariable("--cc-v51-scene-label-mobile")).toBeGreaterThanOrEqual(11);
  });

  it("uses the V5.1 contract variables in the actual telemetry rules", () => {
    expect(css).toContain("font-size: var(--cc-v51-metric-value-desktop)");
    expect(css).toContain("font-size: var(--cc-v51-metric-label-desktop)");
    expect(css).toContain("width: var(--cc-v51-metric-icon)");
    expect(css).toContain("font-size: var(--cc-v51-metric-value-mobile)");
    expect(css).toContain("font-size: var(--cc-v51-metric-label-mobile)");
  });
});
