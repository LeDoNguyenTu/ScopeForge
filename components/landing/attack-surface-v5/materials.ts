import * as THREE from "three";

export type AttackSurfaceV5Materials = Readonly<{
  structure: THREE.MeshStandardMaterial;
  deck: THREE.MeshStandardMaterial;
  structureEdge: THREE.MeshBasicMaterial;
  deckEdge: THREE.MeshBasicMaterial;
  panel: THREE.MeshStandardMaterial;
  glass: THREE.MeshPhysicalMaterial;
  healthy: THREE.MeshStandardMaterial;
  healthyGlow: THREE.MeshBasicMaterial;
  cyanGlow: THREE.MeshBasicMaterial;
  risk: THREE.MeshStandardMaterial;
  riskGlow: THREE.MeshBasicMaterial;
  amberGlow: THREE.MeshBasicMaterial;
  pathHealthy: THREE.MeshBasicMaterial;
  pathRisk: THREE.MeshBasicMaterial;
  pending: THREE.MeshStandardMaterial;
  scanTeal: THREE.MeshBasicMaterial;
  scanRisk: THREE.MeshBasicMaterial;
}>;

export function createV5Materials(): AttackSurfaceV5Materials {
  const structure = new THREE.MeshStandardMaterial({
    color: 0x171c21,
    metalness: 0.88,
    roughness: 0.32,
  });
  const deck = new THREE.MeshStandardMaterial({
    color: 0x252d34,
    metalness: 0.82,
    roughness: 0.27,
  });
  const structureEdge = new THREE.MeshBasicMaterial({
    color: 0x313b43,
    wireframe: true,
    transparent: true,
    opacity: 0.62,
  });
  const deckEdge = new THREE.MeshBasicMaterial({
    color: 0x5ce2c9,
    wireframe: true,
    transparent: true,
    opacity: 0.22,
    blending: THREE.AdditiveBlending,
  });
  const panel = new THREE.MeshStandardMaterial({
    color: 0x0a0c10,
    emissive: 0x0d3837,
    emissiveIntensity: 0.24,
    metalness: 0.42,
    roughness: 0.24,
    transparent: true,
    opacity: 0.42,
    side: THREE.DoubleSide,
  });
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x173a3b,
    metalness: 0.08,
    roughness: 0.08,
    transmission: 0.22,
    thickness: 0.35,
    transparent: true,
    opacity: 0.34,
    side: THREE.DoubleSide,
  });
  const healthy = new THREE.MeshStandardMaterial({
    color: 0x163033,
    emissive: 0x38e4de,
    emissiveIntensity: 1.45,
    metalness: 0.54,
    roughness: 0.23,
  });
  const healthyGlow = new THREE.MeshBasicMaterial({
    color: 0x5ce2c9,
    transparent: true,
    opacity: 0.78,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const cyanGlow = new THREE.MeshBasicMaterial({
    color: 0x38e4de,
    transparent: true,
    opacity: 0.72,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const risk = new THREE.MeshStandardMaterial({
    color: 0x32150d,
    emissive: 0xff6a38,
    emissiveIntensity: 1.75,
    metalness: 0.5,
    roughness: 0.22,
  });
  const riskGlow = new THREE.MeshBasicMaterial({
    color: 0xff6a38,
    transparent: true,
    opacity: 0.82,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const amberGlow = new THREE.MeshBasicMaterial({
    color: 0xf8b45b,
    transparent: true,
    opacity: 0.86,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const pathHealthy = new THREE.MeshBasicMaterial({
    color: 0x38e4de,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const pathRisk = new THREE.MeshBasicMaterial({
    color: 0xff6a38,
    transparent: true,
    opacity: 0.96,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const pending = new THREE.MeshStandardMaterial({
    color: 0x252d34,
    emissive: 0x313b43,
    emissiveIntensity: 0.46,
    metalness: 0.55,
    roughness: 0.36,
  });
  const scanTeal = new THREE.MeshBasicMaterial({
    color: 0x5ce2c9,
    transparent: true,
    opacity: 0.18,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const scanRisk = new THREE.MeshBasicMaterial({
    color: 0xff6a38,
    transparent: true,
    opacity: 0.2,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  return Object.freeze({
    structure,
    deck,
    structureEdge,
    deckEdge,
    panel,
    glass,
    healthy,
    healthyGlow,
    cyanGlow,
    risk,
    riskGlow,
    amberGlow,
    pathHealthy,
    pathRisk,
    pending,
    scanTeal,
    scanRisk,
  });
}
