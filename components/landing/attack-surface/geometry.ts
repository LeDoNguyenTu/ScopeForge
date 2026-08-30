import { ATTACK_SURFACE_ARMS, type QualityProfile } from "@/components/landing/attack-surface/constants";

type Vec3 = readonly [number, number, number];
type RGB = readonly [number, number, number];

type MutableGeometry = {
  linePositions: number[];
  lineColors: number[];
  lineMotion: number[];
  surfacePositions: number[];
  surfaceColors: number[];
  surfaceMotion: number[];
};

export type AttackSurfaceGeometry = Readonly<{
  linePositions: Float32Array;
  lineColors: Float32Array;
  lineMotion: Float32Array;
  surfacePositions: Float32Array;
  surfaceColors: Float32Array;
  surfaceMotion: Float32Array;
  particlePositions: Float32Array;
  particleColors: Float32Array;
  particleSeeds: Float32Array;
  armEndpoints: readonly Vec3[];
  pulsePaths: readonly Float32Array[];
}>;

const TEAL: RGB = [0.28, 0.95, 0.78];
const CYAN: RGB = [0.32, 0.78, 0.92];
const ORANGE: RGB = [1, 0.38, 0.12];
const AMBER: RGB = [1, 0.66, 0.22];
const STEEL: RGB = [0.22, 0.43, 0.48];
const DIM: RGB = [0.08, 0.18, 0.21];
const GLASS: RGB = [0.09, 0.36, 0.38];

function pushVertex(target: number[], value: Vec3) {
  target.push(value[0], value[1], value[2]);
}

function pushColor(target: number[], value: RGB, strength = 1) {
  target.push(value[0] * strength, value[1] * strength, value[2] * strength);
}

function addLine(state: MutableGeometry, from: Vec3, to: Vec3, color: RGB, strength = 1, motion = 0) {
  pushVertex(state.linePositions, from);
  pushVertex(state.linePositions, to);
  pushColor(state.lineColors, color, strength);
  pushColor(state.lineColors, color, strength);
  state.lineMotion.push(motion, motion);
}

function addTriangle(state: MutableGeometry, a: Vec3, b: Vec3, c: Vec3, color: RGB, strength = 1, motion = 0) {
  pushVertex(state.surfacePositions, a);
  pushVertex(state.surfacePositions, b);
  pushVertex(state.surfacePositions, c);
  pushColor(state.surfaceColors, color, strength);
  pushColor(state.surfaceColors, color, strength);
  pushColor(state.surfaceColors, color, strength);
  state.surfaceMotion.push(motion, motion, motion);
}

function addQuad(state: MutableGeometry, a: Vec3, b: Vec3, c: Vec3, d: Vec3, color: RGB, strength = 1, motion = 0) {
  addTriangle(state, a, b, c, color, strength, motion);
  addTriangle(state, a, c, d, color, strength, motion);
}

function radialPoint(angleDegrees: number, radius: number, y = 0): Vec3 {
  const angle = angleDegrees * Math.PI / 180;
  return [Math.cos(angle) * radius, y, Math.sin(angle) * radius];
}

function addRing(state: MutableGeometry, radius: number, y: number, color: RGB, strength: number, segments: number, motion: number) {
  for (let index = 0; index < segments; index += 1) {
    const a = index / segments * Math.PI * 2;
    const b = (index + 1) / segments * Math.PI * 2;
    addLine(
      state,
      [Math.cos(a) * radius, y, Math.sin(a) * radius],
      [Math.cos(b) * radius, y, Math.sin(b) * radius],
      color,
      strength,
      motion,
    );
  }
}

function addBox(state: MutableGeometry, center: Vec3, size: Vec3, color: RGB, strength = 1, motion = 0, surfaces = false) {
  const [cx, cy, cz] = center;
  const hx = size[0] / 2;
  const hy = size[1] / 2;
  const hz = size[2] / 2;
  const corners: Vec3[] = [
    [cx - hx, cy - hy, cz - hz],
    [cx + hx, cy - hy, cz - hz],
    [cx + hx, cy + hy, cz - hz],
    [cx - hx, cy + hy, cz - hz],
    [cx - hx, cy - hy, cz + hz],
    [cx + hx, cy - hy, cz + hz],
    [cx + hx, cy + hy, cz + hz],
    [cx - hx, cy + hy, cz + hz],
  ];
  const edges = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ] as const;
  edges.forEach(([a, b]) => addLine(state, corners[a], corners[b], color, strength, motion));
  addLine(state, corners[0], corners[6], color, strength * 0.28, motion);
  addLine(state, corners[1], corners[7], color, strength * 0.28, motion);
  if (surfaces) {
    addQuad(state, corners[3], corners[2], corners[6], corners[7], GLASS, 0.22, motion);
    addQuad(state, corners[0], corners[1], corners[5], corners[4], GLASS, 0.14, motion);
  }
}

function armPoint(angleDegrees: number, length: number, radius: number, lateral = 0, vertical = 0): Vec3 {
  const angle = angleDegrees * Math.PI / 180;
  const normalX = -Math.sin(angle);
  const normalZ = Math.cos(angle);
  const progress = Math.max(0, Math.min(1, radius / Math.max(0.001, length)));
  const lift = Math.sin(progress * Math.PI) * 0.11 + progress * 0.08;
  return [
    Math.cos(angle) * radius + normalX * lateral,
    lift + vertical,
    Math.sin(angle) * radius + normalZ * lateral,
  ];
}

function createPulsePath(angle: number, length: number, risk: boolean) {
  const samples = 72;
  const values = new Float32Array(samples * 3);
  for (let index = 0; index < samples; index += 1) {
    const t = index / (samples - 1);
    const radius = 0.28 + (length - 0.28) * t;
    const lateral = Math.sin(t * Math.PI * 1.6) * (risk ? 0.07 : 0.04);
    const point = armPoint(angle, length, radius, lateral, 0.13 + Math.sin(t * Math.PI) * 0.05);
    values[index * 3] = point[0];
    values[index * 3 + 1] = point[1];
    values[index * 3 + 2] = point[2];
  }
  return values;
}

export function createAttackSurfaceGeometry(profile: QualityProfile): AttackSurfaceGeometry {
  const state: MutableGeometry = {
    linePositions: [],
    lineColors: [],
    lineMotion: [],
    surfacePositions: [],
    surfaceColors: [],
    surfaceMotion: [],
  };

  const ringSegments = Math.max(36, profile.armSegments * 7);
  addRing(state, 0.36, 0.02, AMBER, 0.82, ringSegments, 1);
  addRing(state, 0.52, -0.02, TEAL, 0.7, ringSegments, 2);
  addRing(state, 0.72, -0.07, CYAN, 0.52, ringSegments, 1);
  addRing(state, 0.98, -0.1, STEEL, 0.48, ringSegments, 2);
  addRing(state, 1.28, -0.13, DIM, 0.55, ringSegments, 1);
  addRing(state, 1.58, -0.16, DIM, 0.32, ringSegments, 2);

  for (let index = 0; index < 16; index += 1) {
    const angle = index * 22.5 + 11.25;
    addLine(state, radialPoint(angle, 0.38, 0.02), radialPoint(angle, 0.98, -0.1), index % 4 === 0 ? TEAL : STEEL, index % 4 === 0 ? 0.58 : 0.25, index % 2 ? 1 : 2);
  }

  addBox(state, [0, 0.12, 0], [0.84, 0.24, 0.84], TEAL, 0.58, 1, profile.transparentPanels);
  addBox(state, [0, 0.3, 0], [0.52, 0.18, 0.52], AMBER, 0.54, 2, profile.transparentPanels);
  addBox(state, [0, 0.45, 0], [0.2, 0.14, 0.2], ORANGE, 0.82, 1, false);

  const endpoints: Vec3[] = [];
  const pulsePaths: Float32Array[] = [];

  ATTACK_SURFACE_ARMS.forEach((arm, armIndex) => {
    const riskColor = arm.risk ? ORANGE : armIndex % 2 === 0 ? CYAN : TEAL;
    const start = 0.55;
    const end = arm.length;
    const width = arm.risk ? 0.2 : 0.18;
    const height = 0.1;
    const segments = profile.armSegments;

    const rails = [
      [-width, -height], [width, -height], [-width, height], [width, height],
    ] as const;
    rails.forEach(([lateral, vertical], railIndex) => {
      addLine(
        state,
        armPoint(arm.angle, arm.length, start, lateral, vertical),
        armPoint(arm.angle, arm.length, end, lateral, vertical),
        railIndex >= 2 ? riskColor : STEEL,
        railIndex >= 2 ? 0.82 : 0.5,
        3 + armIndex,
      );
    });

    for (let step = 0; step <= segments; step += 1) {
      const t = step / segments;
      const radius = start + (end - start) * t;
      const leftTop = armPoint(arm.angle, arm.length, radius, -width, height);
      const rightTop = armPoint(arm.angle, arm.length, radius, width, height);
      const leftBottom = armPoint(arm.angle, arm.length, radius, -width, -height);
      const rightBottom = armPoint(arm.angle, arm.length, radius, width, -height);
      addLine(state, leftTop, rightTop, step % 2 === 0 ? riskColor : STEEL, step % 2 === 0 ? 0.58 : 0.34, 3 + armIndex);
      addLine(state, leftBottom, rightBottom, STEEL, 0.28, 3 + armIndex);

      if (step < segments) {
        const nextRadius = start + (end - start) * ((step + 1) / segments);
        const nextLeftTop = armPoint(arm.angle, arm.length, nextRadius, -width, height);
        const nextRightTop = armPoint(arm.angle, arm.length, nextRadius, width, height);
        if (step % 2 === 0) {
          addLine(state, leftTop, nextRightTop, riskColor, arm.risk ? 0.58 : 0.35, 3 + armIndex);
          addLine(state, rightBottom, armPoint(arm.angle, arm.length, nextRadius, -width, -height), STEEL, 0.24, 3 + armIndex);
        } else {
          addLine(state, rightTop, nextLeftTop, riskColor, arm.risk ? 0.58 : 0.35, 3 + armIndex);
          addLine(state, leftBottom, armPoint(arm.angle, arm.length, nextRadius, width, -height), STEEL, 0.24, 3 + armIndex);
        }

        if (profile.transparentPanels) {
          const nextLeft = armPoint(arm.angle, arm.length, nextRadius, -width * 0.86, 0.02);
          const nextRight = armPoint(arm.angle, arm.length, nextRadius, width * 0.86, 0.02);
          const left = armPoint(arm.angle, arm.length, radius, -width * 0.86, 0.02);
          const right = armPoint(arm.angle, arm.length, radius, width * 0.86, 0.02);
          addQuad(state, left, right, nextRight, nextLeft, arm.risk ? ORANGE : GLASS, arm.risk ? 0.08 : 0.11, 3 + armIndex);
        }
      }
    }

    const endpoint = armPoint(arm.angle, arm.length, end, 0, 0.22);
    endpoints.push(endpoint);
    addBox(state, endpoint, [0.62, 0.42, 0.62], riskColor, 0.88, 9 + armIndex, profile.transparentPanels);
    addBox(state, [endpoint[0], endpoint[1] + 0.28, endpoint[2]], [0.38, 0.16, 0.38], riskColor, 0.62, 9 + armIndex, profile.transparentPanels);

    for (let level = 1; level < arm.towerLevels; level += 1) {
      const scale = Math.max(0.24, 0.38 - level * 0.035);
      addBox(
        state,
        [endpoint[0], endpoint[1] + 0.34 + level * 0.31, endpoint[2]],
        [scale, 0.24, scale],
        riskColor,
        0.7 - level * 0.1,
        9 + armIndex,
        profile.transparentPanels,
      );
    }

    pulsePaths.push(createPulsePath(arm.angle, arm.length, arm.risk));
  });

  const particlePositions = new Float32Array(profile.particles * 3);
  const particleColors = new Float32Array(profile.particles * 3);
  const particleSeeds = new Float32Array(profile.particles);
  for (let index = 0; index < profile.particles; index += 1) {
    const angle = index * 2.399963229728653;
    const radius = 0.75 + ((index * 37) % 270) / 100;
    const height = -0.28 + ((index * 29) % 125) / 100;
    particlePositions[index * 3] = Math.cos(angle) * radius;
    particlePositions[index * 3 + 1] = height;
    particlePositions[index * 3 + 2] = Math.sin(angle) * radius;
    const color = index % 19 === 0 ? AMBER : index % 11 === 0 ? TEAL : DIM;
    particleColors[index * 3] = color[0];
    particleColors[index * 3 + 1] = color[1];
    particleColors[index * 3 + 2] = color[2];
    particleSeeds[index] = (index * 0.61803398875) % 1;
  }

  return Object.freeze({
    linePositions: new Float32Array(state.linePositions),
    lineColors: new Float32Array(state.lineColors),
    lineMotion: new Float32Array(state.lineMotion),
    surfacePositions: new Float32Array(state.surfacePositions),
    surfaceColors: new Float32Array(state.surfaceColors),
    surfaceMotion: new Float32Array(state.surfaceMotion),
    particlePositions,
    particleColors,
    particleSeeds,
    armEndpoints: Object.freeze(endpoints),
    pulsePaths: Object.freeze(pulsePaths),
  });
}
