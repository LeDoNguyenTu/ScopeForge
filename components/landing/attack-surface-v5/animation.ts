import * as THREE from "three";

export type AttackSurfaceV5Pointer = Readonly<{ x: number; y: number }>;

export function updateAttackSurfaceV5Animation(group: THREE.Group, elapsed: number, pointer: AttackSurfaceV5Pointer): void {
  group.rotation.y = THREE.MathUtils.lerp(group.rotation.y, pointer.x * 0.08, 0.045);
  group.rotation.x = THREE.MathUtils.lerp(group.rotation.x, pointer.y * 0.025, 0.045);
  group.position.y = Math.sin(elapsed * 0.42) * 0.035;

  const core = group.userData.v5Core as THREE.Group | undefined;
  const rings = (core?.userData.v5Rings as THREE.Mesh[] | undefined) ?? [];
  for (const ring of rings) {
    const speed = Number(ring.userData.v5RingSpeed ?? 0.05);
    ring.rotation.z = elapsed * speed;
  }

  group.traverse((object) => {
    if (!object.name.startsWith("v5-pulse-")) return;
    const pulse = object as THREE.Mesh;
    const curve = pulse.userData.v5Curve as THREE.Curve<THREE.Vector3> | undefined;
    if (!curve) return;
    const offset = Number(pulse.userData.v5Offset ?? 0);
    const progress = (elapsed * 0.12 + offset) % 1;
    pulse.position.copy(curve.getPoint(progress));
    const scale = 0.82 + Math.sin(elapsed * 4.5 + offset * 9) * 0.22;
    pulse.scale.setScalar(scale);
  });
}
