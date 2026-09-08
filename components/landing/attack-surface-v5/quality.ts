export type AttackSurfaceV5Quality = "cinematic" | "balanced" | "constrained" | "reduced";

export type AttackSurfaceV5QualityInput = Readonly<{
  width: number;
  dpr: number;
  reducedMotion: boolean;
  deviceMemory?: number;
  frameTimeMs?: number;
}>;

export type AttackSurfaceV5QualitySettings = Readonly<{
  dprCap: number;
  antialias: boolean;
  bloom: boolean;
  particleFactor: number;
  transparentPanels: boolean;
}>;

const SETTINGS: Readonly<Record<AttackSurfaceV5Quality, AttackSurfaceV5QualitySettings>> = Object.freeze({
  cinematic: Object.freeze({ dprCap: 2, antialias: true, bloom: true, particleFactor: 1, transparentPanels: true }),
  balanced: Object.freeze({ dprCap: 1.75, antialias: true, bloom: true, particleFactor: 0.6, transparentPanels: true }),
  constrained: Object.freeze({ dprCap: 1.35, antialias: false, bloom: false, particleFactor: 0.25, transparentPanels: false }),
  reduced: Object.freeze({ dprCap: 1.25, antialias: false, bloom: false, particleFactor: 0, transparentPanels: false }),
});

export function selectAttackSurfaceV5Quality(input: AttackSurfaceV5QualityInput): AttackSurfaceV5Quality {
  if (input.reducedMotion) return "reduced";

  const memory = input.deviceMemory ?? 4;
  const frameTime = input.frameTimeMs ?? 16.7;

  if (memory <= 2 || frameTime >= 34) return "constrained";

  const desktopClass = input.width >= 1180;
  const capableGpuSignal = input.dpr >= 1.5;
  const healthyFrameTime = frameTime <= 20;

  if (desktopClass && memory >= 6 && capableGpuSignal && healthyFrameTime) {
    return "cinematic";
  }

  if (memory >= 4 && input.dpr >= 1.25 && frameTime < 28) {
    return "balanced";
  }

  return "constrained";
}

export function getAttackSurfaceV5QualitySettings(quality: AttackSurfaceV5Quality): AttackSurfaceV5QualitySettings {
  return SETTINGS[quality];
}
