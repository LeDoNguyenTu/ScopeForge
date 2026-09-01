import * as THREE from "three";

export type AttackSurfaceV5Materials = Readonly<{
  structure: THREE.MeshStandardMaterial;
  deck: THREE.MeshStandardMaterial;
  structureEdge: THREE.MeshBasicMaterial;
  deckEdge: THREE.MeshBasicMaterial;
  riskEdge: THREE.MeshBasicMaterial;
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
  const structure = new THREE.MeshStandardMaterial({ color: 0x171c21, metalness: 0.9, roughness: 0.29 });
  const deck = new THREE.MeshStandardMaterial({ color: 0x252d34, metalness: 0.84, roughness: 0.25 });
  const structureEdge = new THREE.MeshBasicMaterial({ color: 0x44515a, wireframe: true, transparent: true, opacity: 0.58 });
  const deckEdge = new THREE.MeshBasicMaterial({ color: 0x5ce2c9, wireframe: true, transparent: true, opacity: 0.26, blending: THREE.AdditiveBlending, depthWrite: false });
  const riskEdge = new THREE.MeshBasicMaterial({ color: 0xff6a38, wireframe: true, transparent: true, opacity: 0.58, blending: THREE.AdditiveBlending, depthWrite: false });
  const panel = new THREE.MeshStandardMaterial({ color: 0x0a0c10, emissive: 0x0d3837, emissiveIntensity: 0.26, metalness: 0.46, roughness: 0.22, transparent: true, opacity: 0.44, side: THREE.DoubleSide });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x173a3b, metalness: 0.1, roughness: 0.06, transmission: 0.28, thickness: 0.38, transparent: true, opacity: 0.36, side: THREE.DoubleSide });
  const healthy = new THREE.MeshStandardMaterial({ color: 0x163033, emissive: 0x38e4de, emissiveIntensity: 1.5, metalness: 0.58, roughness: 0.2 });
  const healthyGlow = new THREE.MeshBasicMaterial({ color: 0x5ce2c9, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
  const cyanGlow = new THREE.MeshBasicMaterial({ color: 0x38e4de, transparent: true, opacity: 0.76, blending: THREE.AdditiveBlending, depthWrite: false });
  const risk = new THREE.MeshStandardMaterial({ color: 0x32150d, emissive: 0xff6a38, emissiveIntensity: 1.92, metalness: 0.54, roughness: 0.19 });
  const riskGlow = new THREE.MeshBasicMaterial({ color: 0xff6a38, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  const amberGlow = new THREE.MeshBasicMaterial({ color: 0xf8b45b, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  const pathHealthy = new THREE.MeshBasicMaterial({ color: 0x38e4de, transparent: true, opacity: 0.94, blending: THREE.AdditiveBlending, depthWrite: false });
  const pathRisk = new THREE.MeshBasicMaterial({ color: 0xff6a38, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
  const pending = new THREE.MeshStandardMaterial({ color: 0x252d34, emissive: 0x313b43, emissiveIntensity: 0.46, metalness: 0.55, roughness: 0.36 });
  const scanTeal = new THREE.MeshBasicMaterial({ color: 0x5ce2c9, transparent: true, opacity: 0.16, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
  const scanRisk = new THREE.MeshBasicMaterial({ color: 0xff6a38, transparent: true, opacity: 0.24, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });

  return Object.freeze({ structure, deck, structureEdge, deckEdge, riskEdge, panel, glass, healthy, healthyGlow, cyanGlow, risk, riskGlow, amberGlow, pathHealthy, pathRisk, pending, scanTeal, scanRisk });
}
