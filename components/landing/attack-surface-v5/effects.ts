import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { VignetteShader } from "three/examples/jsm/shaders/VignetteShader.js";
import type { AttackSurfaceV5Quality } from "./quality";
import { getAttackSurfaceV5QualitySettings } from "./quality";

export type AttackSurfaceV5Composer = EffectComposer;

export function createV5Composer(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, quality: AttackSurfaceV5Quality): AttackSurfaceV5Composer | null {
  const settings = getAttackSurfaceV5QualitySettings(quality);
  if (!settings.bloom) return null;

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(1, 1),
    quality === "cinematic" ? 0.86 : 0.56,
    quality === "cinematic" ? 0.68 : 0.58,
    quality === "cinematic" ? 0.2 : 0.26,
  );
  composer.addPass(bloom);

  const vignette = new ShaderPass(VignetteShader);
  vignette.uniforms.offset.value = quality === "cinematic" ? 0.96 : 1.02;
  vignette.uniforms.darkness.value = quality === "cinematic" ? 1.08 : 0.92;
  composer.addPass(vignette);
  composer.addPass(new OutputPass());
  return composer;
}
