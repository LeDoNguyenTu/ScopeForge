import { describe, expect, it } from "vitest";
import { createIllustrativeAttackSurfaceV5Model } from "@/components/landing/attack-surface-v5/model";
import { createAttackSurfaceV5Group } from "@/components/landing/attack-surface-v5/geometry";
import { updateAttackSurfaceV5Animation } from "@/components/landing/attack-surface-v5/animation";

describe("V5.1 Citadel animation", () => {
  it("registers at least six independent motion channels including atmosphere", () => {
    const group = createAttackSurfaceV5Group(createIllustrativeAttackSurfaceV5Model(), "balanced");
    const channels = group.userData.v5AnimationChannels as string[];

    expect(channels).toEqual(expect.arrayContaining([
      "ring-rotation",
      "core-breathing",
      "path-packets",
      "risk-cascade",
      "endpoint-scan",
      "atmospheric-drift",
    ]));
    expect(new Set(channels).size).toBeGreaterThanOrEqual(6);
    expect(group.getObjectByName("v5-atmosphere-particles")).toBeTruthy();
  });

  it("animates the core, packets, scan plane and atmosphere independently", () => {
    const group = createAttackSurfaceV5Group(createIllustrativeAttackSurfaceV5Model(), "balanced");
    const energy = group.getObjectByName("v5-energy-core")!;
    const pulse = group.getObjectByName("v5-pulse-web-app-0")!;
    const scan = group.getObjectByName("v5-scan-web-app")!;
    const atmosphere = group.getObjectByName("v5-atmosphere-particles")!;

    const before = {
      energyScale: energy.scale.x,
      pulsePosition: pulse.position.clone(),
      scanY: scan.position.y,
      atmosphereRotation: atmosphere.rotation.y,
    };

    updateAttackSurfaceV5Animation(group, 3.2, { x: 0.45, y: -0.25 });

    expect(energy.scale.x).not.toBe(before.energyScale);
    expect(pulse.position.distanceTo(before.pulsePosition)).toBeGreaterThan(0.01);
    expect(scan.position.y).not.toBe(before.scanY);
    expect(atmosphere.rotation.y).not.toBe(before.atmosphereRotation);
  });

  it("is idempotent at a fixed timestamp so tower motion cannot accumulate drift", () => {
    const group = createAttackSurfaceV5Group(createIllustrativeAttackSurfaceV5Model(), "balanced");
    const tower = group.getObjectByName("v5-tower-web-app")!;

    updateAttackSurfaceV5Animation(group, 11.4, { x: 0, y: 0 });
    const firstY = tower.position.y;
    updateAttackSurfaceV5Animation(group, 11.4, { x: 0, y: 0 });

    expect(tower.position.y).toBeCloseTo(firstY, 8);
  });

  it("keeps holographic endpoint float bounded and idempotent over long sessions", () => {
    const group = createAttackSurfaceV5Group(createIllustrativeAttackSurfaceV5Model(), "balanced");
    const cage = group.getObjectByName("v5-holo-cage-web-app")!;
    const initialY = cage.position.y;

    for (let frame = 0; frame < 3600; frame += 1) {
      updateAttackSurfaceV5Animation(group, frame / 60, { x: 0, y: 0 });
    }
    expect(Math.abs(cage.position.y - initialY)).toBeLessThanOrEqual(0.04);

    updateAttackSurfaceV5Animation(group, 42.5, { x: 0, y: 0 });
    const fixedTimestampY = cage.position.y;
    updateAttackSurfaceV5Animation(group, 42.5, { x: 0, y: 0 });
    expect(cage.position.y).toBeCloseTo(fixedTimestampY, 8);
  });
});
