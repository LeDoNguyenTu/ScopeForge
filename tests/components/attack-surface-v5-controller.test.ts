import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { disposeAttackSurfaceV5Object } from "@/components/landing/attack-surface-v5/controller";

describe("V5 renderer lifecycle", () => {
  it("disposes mesh geometry and materials when the scene is retired", () => {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial();
    const geometryDisposed = vi.fn();
    const materialDisposed = vi.fn();
    geometry.addEventListener("dispose", geometryDisposed);
    material.addEventListener("dispose", materialDisposed);
    const root = new THREE.Group();
    root.add(new THREE.Mesh(geometry, material));

    disposeAttackSurfaceV5Object(root);

    expect(geometryDisposed).toHaveBeenCalledTimes(1);
    expect(materialDisposed).toHaveBeenCalledTimes(1);
  });
});
