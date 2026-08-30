import { SCENE_VERSION } from "@/components/landing/attack-surface/constants";

export { SCENE_VERSION };

export const READY_STORAGE_KEY = "scopeforge:attack-surface-ready";

export type BootMilestone = "module" | "capability" | "geometry" | "materials" | "first-frame";

const milestoneProgress: Readonly<Record<BootMilestone, number>> = Object.freeze({
  module: 20,
  capability: 32,
  geometry: 62,
  materials: 82,
  "first-frame": 100,
});

export function createSceneProgress() {
  let current = 0;

  return {
    mark(milestone: BootMilestone) {
      current = Math.max(current, milestoneProgress[milestone]);
      return current;
    },
    value() {
      return current;
    },
  };
}
