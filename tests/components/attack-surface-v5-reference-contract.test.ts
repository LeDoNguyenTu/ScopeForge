import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createAttackSurfaceV5Group } from "@/components/landing/attack-surface-v5/geometry";
import { createV5Materials } from "@/components/landing/attack-surface-v5/materials";
import { createIllustrativeAttackSurfaceV5Model } from "@/components/landing/attack-surface-v5/model";
import { getAttackSurfaceV5CameraPreset, projectAttackSurfaceV5Anchors } from "@/components/landing/attack-surface-v5/controller";

const countNamed = (root: THREE.Object3D, prefix: string) => {
  let count = 0;
  root.traverse((object) => {
    if (object.name.startsWith(prefix)) count += 1;
  });
  return count;
};

describe("V5 reference reconstruction contract", () => {
  it("builds each arm from layered armor, cavities, braces, and embedded route hardware", () => {
    const model = createIllustrativeAttackSurfaceV5Model();
    const group = createAttackSurfaceV5Group(model, "balanced");

    for (const entity of model.entities) {
      expect(countNamed(group, `v5-arm-plate-${entity.id}-`), entity.id).toBeGreaterThanOrEqual(12);
      expect(countNamed(group, `v5-arm-cavity-${entity.id}-`), entity.id).toBeGreaterThanOrEqual(5);
      expect(countNamed(group, `v5-arm-brace-${entity.id}-`), entity.id).toBeGreaterThanOrEqual(10);
      expect(countNamed(group, `v5-arm-node-light-${entity.id}-`), entity.id).toBeGreaterThanOrEqual(8);
    }
  });

  it("builds the central hub from dense segmented mechanical armor rather than exposed rings alone", () => {
    const group = createAttackSurfaceV5Group(createIllustrativeAttackSurfaceV5Model(), "balanced");
    const core = group.getObjectByName("v5-citadel-core")!;

    expect(countNamed(core, "v5-core-armor-")).toBeGreaterThanOrEqual(24);
    expect(countNamed(core, "v5-core-cavity-")).toBeGreaterThanOrEqual(12);
    expect(countNamed(core, "v5-core-rim-segment-")).toBeGreaterThanOrEqual(24);
    expect(countNamed(core, "v5-core-panel-light-")).toBeGreaterThanOrEqual(12);
  });

  it("gives the hub a shielded orange reactor star instead of a generic glowing primitive", () => {
    const group = createAttackSurfaceV5Group(createIllustrativeAttackSurfaceV5Model(), "balanced");
    const core = group.getObjectByName("v5-citadel-core")!;

    expect(core.getObjectByName("v5-core-reactor-star")).toBeTruthy();
    expect(countNamed(core, "v5-core-star-spoke-")).toBeGreaterThanOrEqual(8);
    expect(countNamed(core, "v5-core-shield-frame-")).toBeGreaterThanOrEqual(6);
    expect(countNamed(core, "v5-core-reactor-node-")).toBeGreaterThanOrEqual(6);
  });

  it("gives every endpoint a multi-layer holographic cage instead of a simple tower", () => {
    const model = createIllustrativeAttackSurfaceV5Model();
    const group = createAttackSurfaceV5Group(model, "balanced");

    for (const entity of model.entities) {
      expect(countNamed(group, `v5-holo-frame-${entity.id}-`), entity.id).toBeGreaterThanOrEqual(8);
      expect(countNamed(group, `v5-holo-node-${entity.id}-`), entity.id).toBeGreaterThanOrEqual(6);
      expect(group.getObjectByName(`v5-holo-core-${entity.id}`), entity.id).toBeTruthy();
    }
  });

  it("uses a sufficiently elevated and wide desktop camera to read the complete six-arm topology", () => {
    const desktop = getAttackSurfaceV5CameraPreset("desktop");
    const mobile = getAttackSurfaceV5CameraPreset("mobile");

    expect(desktop.position[1]).toBeGreaterThanOrEqual(11);
    expect(desktop.position[2]).toBeGreaterThanOrEqual(22);
    expect(desktop.fov).toBeLessThanOrEqual(36);
    expect(desktop.surfaceScale).toBeLessThanOrEqual(0.76);
    expect(mobile.position[1]).toBeGreaterThanOrEqual(16);
    expect(mobile.surfaceScale).toBeLessThanOrEqual(0.64);
  });

  it("keeps all six projected desktop labels safely separated and inside the 1920x1080 graph frame", () => {
    const width = 1920;
    const height = 1080;
    const preset = getAttackSurfaceV5CameraPreset("desktop");
    const group = createAttackSurfaceV5Group(createIllustrativeAttackSurfaceV5Model(), "balanced");
    group.scale.setScalar(preset.surfaceScale);
    group.position.y = preset.surfaceY;

    const camera = new THREE.PerspectiveCamera(preset.fov, width / height, 0.1, 120);
    camera.position.set(...preset.position);
    camera.lookAt(...preset.target);
    camera.updateProjectionMatrix();

    const anchors = projectAttackSurfaceV5Anchors(group, camera, width, height);
    expect(anchors).toHaveLength(6);
    for (const anchor of anchors) {
      expect(anchor.visible, anchor.id).toBe(true);
      expect(anchor.x, `${anchor.id} x`).toBeGreaterThan(72);
      expect(anchor.x, `${anchor.id} x`).toBeLessThan(width - 72);
      expect(anchor.y, `${anchor.id} y`).toBeGreaterThan(72);
      expect(anchor.y, `${anchor.id} y`).toBeLessThan(height - 72);
      expect(Math.hypot(anchor.x - width / 2, anchor.y - height / 2), `${anchor.id} hub clearance`).toBeGreaterThan(150);
    }

    for (let left = 0; left < anchors.length; left += 1) {
      for (let right = left + 1; right < anchors.length; right += 1) {
        const distance = Math.hypot(anchors[left].x - anchors[right].x, anchors[left].y - anchors[right].y);
        expect(distance, `${anchors[left].id}/${anchors[right].id} separation`).toBeGreaterThan(90);
      }
    }
  });

  it("provides a real nano-tech transition shader for one live structural branch", () => {
    const materials = createV5Materials();
    expect(materials.nanoTransition).toBeInstanceOf(THREE.ShaderMaterial);
    const shader = materials.nanoTransition as THREE.ShaderMaterial;
    expect(shader.uniforms.uProgress).toBeTruthy();
    expect(shader.fragmentShader).toContain("carbonWeave");
    expect(shader.fragmentShader).toContain("voronoi");
    expect(shader.fragmentShader).toContain("hexGrid");
    expect(shader.fragmentShader).toContain("metallicSurface");
    expect(shader.vertexShader).toContain("displacement");
  });
});
