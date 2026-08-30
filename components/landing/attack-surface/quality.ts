import type { AttackSurfaceQuality } from "@/components/landing/attack-surface/constants";

export type QualityInput = Readonly<{
  width: number;
  dpr: number;
  reducedMotion: boolean;
  deviceMemory?: number;
}>;

export function selectAttackSurfaceQuality(input: QualityInput): AttackSurfaceQuality {
  if (input.reducedMotion) return "reduced";
  if (input.width < 768) return "mobile";
  if (input.width < 1280) return "balanced";
  if (input.deviceMemory !== undefined && input.deviceMemory < 6) return "balanced";
  return "high";
}
