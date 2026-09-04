export const SCENE_VERSION = "scopeforge-command-center-v5";
export const READY_STORAGE_KEY = "scopeforge:attack-surface-ready";

export type AttackSurfaceV5BootMilestone = "module" | "capability" | "geometry" | "materials" | "first-frame";

const milestoneProgress: Readonly<Record<AttackSurfaceV5BootMilestone, number>> = Object.freeze({
  module: 20,
  capability: 32,
  geometry: 62,
  materials: 82,
  "first-frame": 100,
});

export function createAttackSurfaceV5Progress() {
  let current = 0;
  return Object.freeze({
    mark(milestone: AttackSurfaceV5BootMilestone) {
      current = Math.max(current, milestoneProgress[milestone]);
      return current;
    },
    value() {
      return current;
    },
  });
}
