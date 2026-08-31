import { describe, expect, it } from "vitest";
import { createIllustrativeAttackSurfaceV5Model } from "@/components/landing/attack-surface-v5/model";

describe("attack surface V5 visual model", () => {
  it("produces a frozen presentation-only scene model with stable entity identities", () => {
    const model = createIllustrativeAttackSurfaceV5Model();
    expect(Object.isFrozen(model)).toBe(true);
    expect(model.entities.length).toBeGreaterThanOrEqual(6);
    expect(new Set(model.entities.map((entity) => entity.id)).size).toBe(model.entities.length);
    expect(model.entities.some((entity) => entity.state === "risk")).toBe(true);
    expect(model.entities.some((entity) => entity.state === "healthy")).toBe(true);
  });
});
