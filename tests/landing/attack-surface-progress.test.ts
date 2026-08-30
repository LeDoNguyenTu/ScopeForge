import { describe, expect, it } from "vitest";
import { createSceneProgress } from "@/components/landing/attack-surface/progress";

describe("createSceneProgress", () => {
  it("reports monotonic progress from completed initialization milestones", () => {
    const progress = createSceneProgress();

    expect(progress.value()).toBe(0);
    expect(progress.mark("module")).toBe(20);
    expect(progress.mark("capability")).toBe(32);
    expect(progress.mark("geometry")).toBe(62);
    expect(progress.mark("materials")).toBe(82);
    expect(progress.mark("first-frame")).toBe(100);
  });

  it("does not regress when milestones are repeated out of order", () => {
    const progress = createSceneProgress();
    expect(progress.mark("geometry")).toBe(62);
    expect(progress.mark("module")).toBe(62);
    expect(progress.mark("geometry")).toBe(62);
    expect(progress.mark("first-frame")).toBe(100);
  });
});
