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
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), quality === "cinematic" ? 0.72 : 0.48, 0.7, 0.3));
  return composer;
}
