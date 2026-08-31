import * as THREE from "three";
import { updateAttackSurfaceV5Animation } from "./animation";
import { createV5Composer, type AttackSurfaceV5Composer } from "./effects";
import { createAttackSurfaceV5Group } from "./geometry";
import { createV5Lighting } from "./lighting";
import type { AttackSurfaceV5Model } from "./model";
import type { AttackSurfaceV5Quality } from "./quality";
import { getAttackSurfaceV5QualitySettings } from "./quality";

export type AttackSurfaceV5Variant = "desktop" | "mobile";

export type AttackSurfaceV5CameraPreset = Readonly<{
  fov: number;
  position: readonly [number, number, number];
  target: readonly [number, number, number];
  surfaceScale: number;
  surfaceY: number;
}>;

const CAMERA_PRESETS: Readonly<Record<AttackSurfaceV5Variant, AttackSurfaceV5CameraPreset>> = Object.freeze({
  desktop: Object.freeze({
    fov: 40,
    position: Object.freeze([0.85, 8.35, 18.15] as const),
    target: Object.freeze([0.35, 0.05, 0] as const),
    surfaceScale: 0.9,
    surfaceY: -0.08,
  }),
  mobile: Object.freeze({
    fov: 49,
    position: Object.freeze([0, 14.4, 20.4] as const),
    target: Object.freeze([0, 0.18, 0] as const),
    surfaceScale: 0.73,
    surfaceY: -0.28,
  }),
});

export function getAttackSurfaceV5CameraPreset(variant: AttackSurfaceV5Variant): AttackSurfaceV5CameraPreset {
  return CAMERA_PRESETS[variant];
}

export type AttackSurfaceV5Controller = Readonly<{
  resize(width: number, height: number, dpr: number): void;
  setPointer(x: number, y: number): void;
  setVisible(visible: boolean): void;
  setPaused(paused: boolean): void;
  render(timeMs: number): void;
  dispose(): void;
  firstStableFrame: Promise<void>;
}>;

export type CreateAttackSurfaceV5ControllerOptions = Readonly<{
  canvas: HTMLCanvasElement;
  model: AttackSurfaceV5Model;
  quality: AttackSurfaceV5Quality;
  variant?: AttackSurfaceV5Variant;
}>;

export function disposeAttackSurfaceV5Object(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();

  root.traverse((object) => {
    const renderable = object as THREE.Mesh;
    if (renderable.geometry) geometries.add(renderable.geometry);
    const material = renderable.material;
    if (Array.isArray(material)) material.forEach((entry) => materials.add(entry));
    else if (material) materials.add(material);
  });

  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

function configureCamera(camera: THREE.PerspectiveCamera, variant: AttackSurfaceV5Variant): void {
  const preset = getAttackSurfaceV5CameraPreset(variant);
  camera.fov = preset.fov;
  camera.position.set(preset.position[0], preset.position[1], preset.position[2]);
  camera.lookAt(preset.target[0], preset.target[1], preset.target[2]);
  camera.updateProjectionMatrix();
}

export function createAttackSurfaceV5Controller(options: CreateAttackSurfaceV5ControllerOptions): AttackSurfaceV5Controller {
  const variant = options.variant ?? "desktop";
  const preset = getAttackSurfaceV5CameraPreset(variant);
  const settings = getAttackSurfaceV5QualitySettings(options.quality);
  const renderer = new THREE.WebGLRenderer({
    canvas: options.canvas,
    alpha: true,
    antialias: settings.antialias,
    powerPreference: "high-performance",
    premultipliedAlpha: true,
  });
  renderer.setClearColor(0x05070a, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = options.quality === "cinematic" ? 1.22 : options.quality === "balanced" ? 1.12 : 1.02;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(preset.fov, 1, 0.1, 100);
  configureCamera(camera, variant);
  createV5Lighting(scene);

  const surface = createAttackSurfaceV5Group(options.model, options.quality);
  surface.scale.setScalar(preset.surfaceScale);
  surface.position.y = preset.surfaceY;
  scene.add(surface);

  let composer: AttackSurfaceV5Composer | null = createV5Composer(renderer, scene, camera, options.quality);
  let visible = true;
  let paused = false;
  let disposed = false;
  let stableFrameCount = 0;
  let stableResolved = false;
  let resolveStable!: () => void;
  const firstStableFrame = new Promise<void>((resolve) => {
    resolveStable = resolve;
  });
  const pointer = { x: 0, y: 0 };
  const startTime = typeof performance === "undefined" ? 0 : performance.now();

  const resolveFirstStableFrame = () => {
    if (stableResolved || stableFrameCount < 2) return;
    stableResolved = true;
    resolveStable();
  };

  return Object.freeze({
    resize(width: number, height: number, dpr: number) {
      if (disposed) return;
      const safeWidth = Math.max(1, Math.round(width));
      const safeHeight = Math.max(1, Math.round(height));
      const pixelRatio = Math.max(1, Math.min(dpr, settings.dprCap));
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(safeWidth, safeHeight, false);
      composer?.setPixelRatio(pixelRatio);
      composer?.setSize(safeWidth, safeHeight);
      camera.aspect = safeWidth / safeHeight;
      configureCamera(camera, variant);
    },
    setPointer(x: number, y: number) {
      pointer.x = THREE.MathUtils.clamp(x, -1, 1);
      pointer.y = THREE.MathUtils.clamp(y, -1, 1);
    },
    setVisible(nextVisible: boolean) {
      visible = nextVisible;
    },
    setPaused(nextPaused: boolean) {
      paused = nextPaused;
    },
    render(timeMs: number) {
      if (disposed || !visible || paused) return;
      const elapsed = Math.max(0, timeMs - startTime) / 1000;
      updateAttackSurfaceV5Animation(surface, elapsed, pointer);
      if (composer) composer.render();
      else renderer.render(scene, camera);
      stableFrameCount += 1;
      resolveFirstStableFrame();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      disposeAttackSurfaceV5Object(scene);
      composer?.dispose();
      composer = null;
      renderer.dispose();
    },
    firstStableFrame,
  });
}
