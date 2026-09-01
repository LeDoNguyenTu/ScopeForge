import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { createIllustrativeAttackSurfaceV5Model } from "@/components/landing/attack-surface-v5/model";
import { createAttackSurfaceV5Group } from "@/components/landing/attack-surface-v5/geometry";
import {
  disposeAttackSurfaceV5Object,
  getAttackSurfaceV5CameraPreset,
  projectAttackSurfaceV5Anchors,
} from "@/components/landing/attack-surface-v5/controller";

describe("V5.2 premium renderer lifecycle", () => {
  it("uses a lower, wider desktop camera and a distinct mobile framing preset", () => {
    const desktop = getAttackSurfaceV5CameraPreset("desktop");
    const mobile = getAttackSurfaceV5CameraPreset("mobile");

    expect(desktop.fov).toBeLessThan(mobile.fov);
    expect(desktop.position[1]).toBeLessThan(mobile.position[1]);
    expect(desktop.position[2]).toBeGreaterThanOrEqual(17);
    expect(mobile.position[2]).toBeGreaterThanOrEqual(18);
    expect(desktop.surfaceScale).toBeGreaterThan(mobile.surfaceScale);
    expect(desktop.target).not.toEqual(mobile.target);
  });

  it("projects each DOM annotation from its actual 3D compound anchor", () => {
    const model = createIllustrativeAttackSurfaceV5Model();
    const surface = createAttackSurfaceV5Group(model, "balanced");
    const preset = getAttackSurfaceV5CameraPreset("desktop");
    const camera = new THREE.PerspectiveCamera(preset.fov, 1440 / 900, 0.1, 100);
    camera.position.set(...preset.position);
    camera.lookAt(...preset.target);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    surface.scale.setScalar(preset.surfaceScale);
    surface.position.y = preset.surfaceY;
    surface.updateMatrixWorld(true);

    const anchors = projectAttackSurfaceV5Anchors(surface, camera, 1440, 900);
    expect(anchors).toHaveLength(model.entities.length);
    expect(new Set(anchors.map((anchor) => anchor.id)).size).toBe(model.entities.length);
    expect(anchors.filter((anchor) => anchor.state === "risk").map((anchor) => anchor.id).sort()).toEqual(["data-store", "web-app"]);
    anchors.forEach((anchor) => {
      expect(Number.isFinite(anchor.x)).toBe(true);
      expect(Number.isFinite(anchor.y)).toBe(true);
      expect(anchor.sourceName).toBe(`v5-label-anchor-${anchor.id}`);
    });
  });

  it("disposes shared geometry and materials once when the scene is retired", () => {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial();
    const geometryDisposed = vi.fn();
    const materialDisposed = vi.fn();
    geometry.addEventListener("dispose", geometryDisposed);
    material.addEventListener("dispose", materialDisposed);
    const root = new THREE.Group();
    root.add(new THREE.Mesh(geometry, material));
    root.add(new THREE.Mesh(geometry, material));

    disposeAttackSurfaceV5Object(root);

    expect(geometryDisposed).toHaveBeenCalledTimes(1);
    expect(materialDisposed).toHaveBeenCalledTimes(1);
  });
});
