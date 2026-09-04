import * as THREE from "three";

export type AttackSurfaceV5Materials = Readonly<{
  structure: THREE.MeshStandardMaterial;
  structureEdge: THREE.MeshBasicMaterial;
  panel: THREE.MeshStandardMaterial;
  healthy: THREE.MeshStandardMaterial;
  healthyGlow: THREE.MeshBasicMaterial;
  risk: THREE.MeshStandardMaterial;
  riskGlow: THREE.MeshBasicMaterial;
  pathHealthy: THREE.MeshBasicMaterial;
  pathRisk: THREE.MeshBasicMaterial;
  pending: THREE.MeshStandardMaterial;
}>;

export function createV5Materials(): AttackSurfaceV5Materials {
  const structure = new THREE.MeshStandardMaterial({ color: 0x071519, metalness: 0.72, roughness: 0.38 });
  const structureEdge = new THREE.MeshBasicMaterial({ color: 0x12343b, wireframe: true, transparent: true, opacity: 0.5 });
  const panel = new THREE.MeshStandardMaterial({ color: 0x0a2429, metalness: 0.38, roughness: 0.28, transparent: true, opacity: 0.28, side: THREE.DoubleSide });
  const healthy = new THREE.MeshStandardMaterial({ color: 0x0b2a2e, emissive: 0x00c8c8, emissiveIntensity: 1.2, metalness: 0.5, roughness: 0.3 });
  const healthyGlow = new THREE.MeshBasicMaterial({ color: 0x32f3ec, transparent: true, opacity: 0.62, blending: THREE.AdditiveBlending });
  const risk = new THREE.MeshStandardMaterial({ color: 0x2a140b, emissive: 0xff6a2a, emissiveIntensity: 1.45, metalness: 0.45, roughness: 0.28 });
  const riskGlow = new THREE.MeshBasicMaterial({ color: 0xff7b35, transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending });
  const pathHealthy = new THREE.MeshBasicMaterial({ color: 0x38e4de, transparent: true, opacity: 0.78 });
  const pathRisk = new THREE.MeshBasicMaterial({ color: 0xff7440, transparent: true, opacity: 0.9 });
  const pending = new THREE.MeshStandardMaterial({ color: 0x182a2d, emissive: 0x5f7d82, emissiveIntensity: 0.55, metalness: 0.45, roughness: 0.42 });

  return Object.freeze({ structure, structureEdge, panel, healthy, healthyGlow, risk, riskGlow, pathHealthy, pathRisk, pending });
}
