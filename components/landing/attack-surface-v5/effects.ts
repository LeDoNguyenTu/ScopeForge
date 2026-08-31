import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import type { AttackSurfaceV5Quality } from "./quality";
import { getAttackSurfaceV5QualitySettings } from "./quality";

export type AttackSurfaceV5Composer = EffectComposer;

export function createV5Composer(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  quality: AttackSurfaceV5Quality,
): AttackSurfaceV5Composer | null {
  const settings = getAttackSurfaceV5QualitySettings(quality);
  if (!settings.bloom) return null;

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(1, 1),
    quality === "cinematic" ? 0.96 : 0.62,
    quality === "cinematic" ? 0.82 : 0.68,
    quality === "cinematic" ? 0.16 : 0.22,
  );
  composer.addPass(bloom);
  return composer;
}
