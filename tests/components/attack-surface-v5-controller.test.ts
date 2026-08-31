import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import {
  disposeAttackSurfaceV5Object,
  getAttackSurfaceV5CameraPreset,
} from "@/components/landing/attack-surface-v5/controller";

describe("V5.1 Citadel renderer lifecycle", () => {
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
