import * as THREE from "three";
import type { AttackSurfaceV5Materials } from "./materials";
import type { AttackSurfaceV5Quality } from "./quality";
import { getAttackSurfaceV5QualitySettings } from "./quality";

function createSeededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

export function createCitadelAtmosphere(
  quality: AttackSurfaceV5Quality,
  _materials: AttackSurfaceV5Materials,
): THREE.Group {
  const settings = getAttackSurfaceV5QualitySettings(quality);
  const group = new THREE.Group();
  group.name = "v5-atmosphere";

  const particleCount = Math.max(28, Math.round(220 * settings.particleFactor));
  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);
  const random = createSeededRandom(0x5c0f9e);
  const teal = new THREE.Color(0x5ce2c9);
  const cyan = new THREE.Color(0x38e4de);
  const orange = new THREE.Color(0xff6a38);

  for (let index = 0; index < particleCount; index += 1) {
    const radius = 2.8 + random() * 8.8;
    const angle = random() * Math.PI * 2;
    const height = -1.8 + random() * 6.1;
    const i = index * 3;
    positions[i] = Math.cos(angle) * radius;
    positions[i + 1] = height;
    positions[i + 2] = Math.sin(angle) * radius;

    const color = index % 17 === 0 ? orange : index % 3 === 0 ? cyan : teal;
    const intensity = 0.42 + random() * 0.58;
    colors[i] = color.r * intensity;
    colors[i + 1] = color.g * intensity;
    colors[i + 2] = color.b * intensity;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: quality === "cinematic" ? 0.085 : quality === "balanced" ? 0.072 : 0.06,
    transparent: true,
    opacity: quality === "reduced" ? 0.35 : 0.68,
    vertexColors: true,
    sizeAttenuation: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const particles = new THREE.Points(geometry, material);
  particles.name = "v5-atmosphere-particles";
  group.add(particles);

  const sparkCount = Math.max(8, Math.round(42 * settings.particleFactor));
  const sparkPositions = new Float32Array(sparkCount * 3);
  for (let index = 0; index < sparkCount; index += 1) {
    const radius = 3.2 + random() * 6.4;
    const angle = random() * Math.PI * 2;
    const i = index * 3;
    sparkPositions[i] = Math.cos(angle) * radius;
    sparkPositions[i + 1] = -0.2 + random() * 3.3;
    sparkPositions[i + 2] = Math.sin(angle) * radius;
  }
  const sparkGeometry = new THREE.BufferGeometry();
  sparkGeometry.setAttribute("position", new THREE.BufferAttribute(sparkPositions, 3));
  const sparkMaterial = new THREE.PointsMaterial({
    color: 0xff6a38,
    size: 0.045,
    transparent: true,
    opacity: quality === "reduced" ? 0.12 : 0.38,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const sparks = new THREE.Points(sparkGeometry, sparkMaterial);
  sparks.name = "v5-atmosphere-sparks";
  group.add(sparks);

  group.userData.v5Particles = particles;
  group.userData.v5Sparks = sparks;
  return group;
}
