import * as THREE from "three";

export type AttackSurfaceV5Pointer = Readonly<{ x: number; y: number }>;

export function updateAttackSurfaceV5Animation(group: THREE.Group, elapsed: number, pointer: AttackSurfaceV5Pointer): void {
  const targetYaw = pointer.x * 0.105;
  const targetPitch = pointer.y * 0.035;
  group.rotation.y = THREE.MathUtils.lerp(group.rotation.y, targetYaw, 0.038);
  group.rotation.x = THREE.MathUtils.lerp(group.rotation.x, targetPitch, 0.038);
  group.position.y = Math.sin(elapsed * 0.34) * 0.045;

  const materials = group.userData.v5Materials as { nanoTransition?: THREE.ShaderMaterial } | undefined;
  const nanoTransition = materials?.nanoTransition;
  if (nanoTransition) {
    const timeUniform = nanoTransition.uniforms.uTime;
    const progressUniform = nanoTransition.uniforms.uProgress;
    if (timeUniform) timeUniform.value = elapsed;
    if (progressUniform) progressUniform.value = 0.44 + Math.sin(elapsed * 0.23) * 0.18;
  }

  const core = group.userData.v5Core as THREE.Group | undefined;
  const rings = (core?.userData.v5Rings as THREE.Mesh[] | undefined) ?? [];
  for (const ring of rings) {
    const speed = Number(ring.userData.v5RingSpeed ?? 0.04);
    const phase = Number(ring.userData.v5RingPhase ?? 0);
    ring.rotation.z = elapsed * speed + phase * 0.025;
  }

  const energy = core?.userData.v5EnergyCore as THREE.Mesh | undefined;
  if (energy) {
    const breath = 1 + Math.sin(elapsed * 2.1) * 0.065;
    energy.scale.set(breath, 0.92 + Math.sin(elapsed * 2.1 + 0.9) * 0.08, breath);
    energy.position.y = 0.58 + Math.sin(elapsed * 1.55) * 0.045;
  }

  const energyCap = core?.userData.v5EnergyCap as THREE.Mesh | undefined;
  if (energyCap) {
    const pulse = 0.94 + Math.sin(elapsed * 2.7 + 0.55) * 0.09;
    energyCap.scale.setScalar(pulse);
    energyCap.rotation.y = elapsed * 0.32;
  }

  const halos = (core?.userData.v5Halos as THREE.Mesh[] | undefined) ?? [];
  halos.forEach((halo, index) => {
    halo.rotation.z = elapsed * (index % 2 === 0 ? 0.12 : -0.16) + index * 0.8;
    const haloScale = 1 + Math.sin(elapsed * 1.4 + index * 1.2) * 0.025;
    halo.scale.setScalar(haloScale);
  });

  const beacon = core?.userData.v5Beacon as THREE.Mesh | undefined;
  if (beacon) {
    beacon.rotation.y = elapsed * 0.62;
    beacon.rotation.x = elapsed * 0.18;
    beacon.scale.setScalar(0.9 + Math.sin(elapsed * 3.2) * 0.13);
  }

  group.traverse((object) => {
    if (!object.name.startsWith("v5-pulse-")) return;
    const pulse = object as THREE.Mesh;
    const curve = pulse.userData.v5Curve as THREE.Curve<THREE.Vector3> | undefined;
    if (!curve) return;
    const offset = Number(pulse.userData.v5Offset ?? 0);
    const riskBoost = pulse.userData.v5State === "risk" ? 0.16 : 0.125;
    const progress = (elapsed * riskBoost + offset) % 1;
    pulse.position.copy(curve.getPoint(progress));
    const scale = 0.82 + Math.sin(elapsed * 5.1 + offset * 11) * 0.28;
    pulse.scale.setScalar(scale);
  });

  const riskPaths = (group.userData.v5RiskPaths as THREE.Object3D[] | undefined) ?? [];
  riskPaths.forEach((path, index) => {
    const pulse = 1 + Math.sin(elapsed * 3.15 - index * 1.3) * 0.018;
    path.scale.set(pulse, pulse, pulse);
  });

  const compounds = (group.userData.v5Compounds as THREE.Group[] | undefined) ?? [];
  compounds.forEach((compound, index) => {
    const scan = compound.userData.v5ScanPlane as THREE.Mesh | undefined;
    const antenna = compound.userData.v5AntennaHead as THREE.Mesh | undefined;
    const orbit = compound.userData.v5Orbit as THREE.Mesh | undefined;
    const tower = compound.userData.v5Tower as THREE.Mesh | undefined;
    const holoCage = compound.userData.v5HoloCage as THREE.Group | undefined;
    const holoCore = holoCage?.userData.v5HoloCore as THREE.Mesh | undefined;
    const holoEnergy = holoCage?.userData.v5HoloEnergy as THREE.Mesh | undefined;
    const phase = index * 0.83;
    if (scan) {
      scan.position.y = 0.68 + Math.sin(elapsed * 1.25 + phase) * 0.22;
      scan.rotation.z = elapsed * (index % 2 === 0 ? 0.08 : -0.075);
    }
    if (antenna) {
      antenna.rotation.y = elapsed * 0.72 + phase;
      antenna.scale.setScalar(0.92 + Math.sin(elapsed * 2.8 + phase) * 0.11);
    }
    if (orbit) orbit.rotation.z = elapsed * (index % 2 === 0 ? 0.34 : -0.29) + phase;
    if (tower) {
      const baseY = Number(tower.userData.v5BaseY ?? tower.position.y);
      tower.position.y = baseY + Math.sin(elapsed * 0.82 + phase) * 0.025;
    }
    if (holoCage) {
      holoCage.rotation.y = Math.sin(elapsed * 0.21 + phase) * 0.08;
      holoCage.position.y += Math.sin(elapsed * 0.55 + phase) * 0.00045;
    }
    if (holoCore) {
      holoCore.rotation.x = elapsed * 0.12 + phase;
      holoCore.rotation.y = elapsed * (index % 2 === 0 ? 0.19 : -0.16);
    }
    if (holoEnergy) {
      const holoPulse = 0.84 + Math.sin(elapsed * 2.2 + phase) * 0.12;
      holoEnergy.scale.setScalar(holoPulse);
    }
  });

  const atmosphere = group.userData.v5Atmosphere as THREE.Group | undefined;
  const particles = atmosphere?.userData.v5Particles as THREE.Points | undefined;
  const sparks = atmosphere?.userData.v5Sparks as THREE.Points | undefined;
  if (particles) {
    particles.rotation.y = elapsed * 0.025;
    particles.rotation.z = Math.sin(elapsed * 0.11) * 0.018;
    particles.position.y = Math.sin(elapsed * 0.2) * 0.12;
  }
  if (sparks) {
    sparks.rotation.y = -elapsed * 0.04;
    sparks.position.y = (elapsed * 0.12) % 1.4 - 0.7;
  }
}
