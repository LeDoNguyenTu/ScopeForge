export const SCENE_VERSION = "scopeforge-command-center-v4";

export type AttackSurfaceQuality = "high" | "balanced" | "mobile" | "reduced";

export type QualityProfile = Readonly<{
  dprCap: number;
  armSegments: number;
  particles: number;
  activePulses: number;
  bloom: boolean;
  transparentPanels: boolean;
}>;

export const QUALITY_PROFILES: Readonly<Record<AttackSurfaceQuality, QualityProfile>> = Object.freeze({
  high: Object.freeze({ dprCap: 2, armSegments: 12, particles: 180, activePulses: 6, bloom: true, transparentPanels: true }),
  balanced: Object.freeze({ dprCap: 1.6, armSegments: 9, particles: 110, activePulses: 4, bloom: true, transparentPanels: true }),
  mobile: Object.freeze({ dprCap: 1.35, armSegments: 6, particles: 56, activePulses: 2, bloom: false, transparentPanels: false }),
  reduced: Object.freeze({ dprCap: 1.25, armSegments: 6, particles: 24, activePulses: 0, bloom: false, transparentPanels: false }),
});

export const ATTACK_SURFACE_ARMS = Object.freeze([
  { id: "web-application", angle: -152, length: 3.1, risk: true, towerLevels: 2 },
  { id: "sandbox", angle: -99, length: 2.65, risk: false, towerLevels: 3 },
  { id: "third-party", angle: -39, length: 3.15, risk: false, towerLevels: 2 },
  { id: "data-store", angle: 7, length: 3.35, risk: true, towerLevels: 2 },
  { id: "identity", angle: 61, length: 2.8, risk: false, towerLevels: 2 },
  { id: "cloud", angle: 122, length: 2.75, risk: false, towerLevels: 2 },
] as const);
