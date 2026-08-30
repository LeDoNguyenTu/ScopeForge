import { QUALITY_PROFILES, type AttackSurfaceQuality } from "@/components/landing/attack-surface/constants";

export type PointerState = Readonly<{ x: number; y: number }>;

export function getPulseCount(quality: AttackSurfaceQuality) {
  return QUALITY_PROFILES[quality].activePulses;
}

export function getParallaxStrength(quality: AttackSurfaceQuality) {
  if (quality === "high") return 0.18;
  if (quality === "balanced") return 0.12;
  if (quality === "mobile") return 0.045;
  return 0;
}

export function getRingSpeed(quality: AttackSurfaceQuality, layer: number) {
  if (quality === "reduced") return 0;
  const scale = quality === "high" ? 1 : quality === "balanced" ? 0.72 : 0.42;
  const direction = layer % 2 === 0 ? -1 : 1;
  return direction * (0.018 + Math.min(4, Math.abs(layer)) * 0.006) * scale;
}

export function smoothPointer(current: PointerState, target: PointerState, quality: AttackSurfaceQuality): PointerState {
  if (quality === "reduced") return { x: 0, y: 0 };
  const easing = quality === "mobile" ? 0.035 : 0.065;
  return {
    x: current.x + (target.x - current.x) * easing,
    y: current.y + (target.y - current.y) * easing,
  };
}

export function pulseSampleIndex(timeMs: number, pulseIndex: number, pathLength: number, quality: AttackSurfaceQuality) {
  if (pathLength <= 1 || quality === "reduced") return 0;
  const speed = quality === "mobile" ? 0.00016 : quality === "balanced" ? 0.0002 : 0.000235;
  const phase = (timeMs * speed + pulseIndex * 0.173) % 1;
  return Math.min(pathLength - 1, Math.floor(phase * pathLength));
}

export function particleDrift(seed: number, timeMs: number, quality: AttackSurfaceQuality) {
  if (quality === "reduced") return 0;
  const scale = quality === "mobile" ? 0.012 : 0.02;
  return Math.sin(timeMs * 0.00022 + seed * Math.PI * 2) * scale;
}
