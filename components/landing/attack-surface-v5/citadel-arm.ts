import * as THREE from "three";
import type { AttackSurfaceV5Entity } from "./model";
import type { AttackSurfaceV5Materials } from "./materials";
import type { AttackSurfaceV5Quality } from "./quality";

export type CitadelArmResult = Readonly<{
  group: THREE.Group;
  endpoint: THREE.Vector3;
  angle: number;
  curve: THREE.CatmullRomCurve3;
}>;

function worldPosition(direction: THREE.Vector3, side: THREE.Vector3, radial: number, lateral: number, y: number) {
  return direction.clone().multiplyScalar(radial).add(side.clone().multiplyScalar(lateral)).setY(y);
}

function createFacetedPlateGeometry(length: number, width: number, height: number): THREE.BufferGeometry {
  const lx = length * 0.5;
  const wz = width * 0.5;
  const topInset = width * 0.17;
  const vertices = new Float32Array([
    -lx, 0, -wz,   lx, 0, -wz,   lx, 0, wz,   -lx, 0, wz,
    -lx * 0.82, height, -wz + topInset,   lx * 0.82, height, -wz + topInset,
    lx * 0.82, height, wz - topInset,   -lx * 0.82, height, wz - topInset,
  ]);
  const indices = [
    0, 1, 2, 0, 2, 3,
    4, 6, 5, 4, 7, 6,
    0, 4, 5, 0, 5, 1,
    1, 5, 6, 1, 6, 2,
    2, 6, 7, 2, 7, 3,
    3, 7, 4, 3, 4, 0,
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

export function createCitadelArm(
  entity: AttackSurfaceV5Entity,
  index: number,
  count: number,
  materials: AttackSurfaceV5Materials,
  quality: AttackSurfaceV5Quality,
): CitadelArmResult {
  const angle = (entity.armIndex / count) * Math.PI * 2 - Math.PI / 2;
  const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
  const side = new THREE.Vector3(-direction.z, 0, direction.x);
  const arm = new THREE.Group();
  arm.name = `v5-arm-${entity.id}`;
  arm.userData.v5EntityId = entity.id;
  arm.userData.v5State = entity.state;

  const detailed = quality === "cinematic" || quality === "balanced";
  const segmentLength = 1.38;
  const segmentCenters = [3.82, 5.18, 6.54, 7.9, 9.26];
  const wave = index % 2 === 0 ? 1 : -1;
  const lateralOffsets = [0, 0.16 * wave, -0.08 * wave, 0.2 * wave, 0.05 * wave];
  const pathGlow = entity.state === "risk" ? materials.riskGlow : materials.healthyGlow;
  const plateGeometry = createFacetedPlateGeometry(0.43, 0.34, 0.105);
  const plateGeometryWide = createFacetedPlateGeometry(0.52, 0.4, 0.13);

  segmentCenters.forEach((radial, segmentIndex) => {
    const lateral = lateralOffsets[segmentIndex];
    const taper = 1.08 - segmentIndex * 0.055;
    const deckY = 0.02 + Math.sin(segmentIndex * 0.9 + index * 0.45) * 0.035;

    const bridge = new THREE.Mesh(
      new THREE.BoxGeometry(segmentLength, 0.24, taper),
      segmentIndex % 2 === 0 ? materials.structure : materials.deck,
    );
    bridge.position.copy(worldPosition(direction, side, radial, lateral, deckY - 0.12));
    bridge.rotation.y = -angle;
    bridge.name = `v5-bridge-${entity.id}-${segmentIndex}`;
    arm.add(bridge);

    const wireDeck = new THREE.Mesh(
      new THREE.BoxGeometry(segmentLength * 0.94, 0.055, taper * 0.91),
      materials.deckEdge,
    );
    wireDeck.position.copy(worldPosition(direction, side, radial, lateral, deckY + 0.035));
    wireDeck.rotation.y = -angle;
    arm.add(wireDeck);

    if (detailed) {
      for (let plateIndex = 0; plateIndex < 3; plateIndex += 1) {
        const plateOffset = (plateIndex - 1) * 0.39;
        const plateLateral = lateral + (plateIndex % 2 === 0 ? -0.18 : 0.18) * taper * wave;
        const useTransition = entity.id === "web-app" && segmentIndex >= 1 && segmentIndex <= 3 && plateIndex === 1;
        const plate = new THREE.Mesh(
          plateIndex === 1 ? plateGeometryWide : plateGeometry,
          useTransition ? materials.nanoTransition : (segmentIndex + plateIndex) % 3 === 0 ? materials.deck : materials.structure,
        );
        plate.position.copy(worldPosition(direction, side, radial + plateOffset, plateLateral, deckY + 0.085 + plateIndex * 0.012));
        plate.rotation.y = -angle + (plateIndex - 1) * 0.06 * wave;
        plate.rotation.z = (segmentIndex % 2 === 0 ? 1 : -1) * 0.025;
        plate.name = `v5-arm-plate-${entity.id}-${segmentIndex}-${plateIndex}`;
        arm.add(plate);
      }

      const cavity = new THREE.Mesh(
        new THREE.BoxGeometry(segmentLength * 0.44, 0.045, taper * 0.38),
        materials.panel,
      );
      cavity.position.copy(worldPosition(direction, side, radial + 0.08 * wave, lateral - 0.14 * wave, deckY + 0.11));
      cavity.rotation.y = -angle + 0.04 * wave;
      cavity.name = `v5-arm-cavity-${entity.id}-${segmentIndex}`;
      arm.add(cavity);
    }

    for (const sign of [-1, 1]) {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(segmentLength * 0.96, 0.065, 0.055),
        pathGlow,
      );
      rail.position.copy(worldPosition(direction, side, radial, lateral + sign * taper * 0.43, deckY + 0.28));
      rail.rotation.y = -angle;
      arm.add(rail);

      if (detailed) {
        const sidePlate = new THREE.Mesh(
          new THREE.BoxGeometry(segmentLength * 0.7, 0.36, 0.06),
          segmentIndex % 2 === 0 ? materials.glass : materials.panel,
        );
        sidePlate.position.copy(worldPosition(direction, side, radial, lateral + sign * taper * 0.49, deckY + 0.03));
        sidePlate.rotation.y = -angle;
        arm.add(sidePlate);

        const upperTruss = new THREE.Mesh(
          new THREE.BoxGeometry(segmentLength * 0.76, 0.055, 0.055),
          materials.structureEdge,
        );
        upperTruss.position.copy(worldPosition(direction, side, radial, lateral + sign * taper * 0.31, deckY + 0.48));
        upperTruss.rotation.set(sign * 0.11, -angle, sign * (segmentIndex % 2 === 0 ? 0.16 : -0.16));
        arm.add(upperTruss);

        const diagonalBrace = new THREE.Mesh(
          new THREE.BoxGeometry(segmentLength * 0.62, 0.075, 0.075),
          materials.structure,
        );
        diagonalBrace.position.copy(worldPosition(direction, side, radial, lateral + sign * taper * 0.31, deckY - 0.21));
        diagonalBrace.rotation.set(sign * 0.12, -angle, sign * (segmentIndex % 2 === 0 ? 0.22 : -0.22));
        diagonalBrace.name = `v5-arm-brace-${entity.id}-${segmentIndex}-${sign > 0 ? "r" : "l"}`;
        arm.add(diagonalBrace);
      }
    }

    const crossbeam = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.1, taper * 1.24),
      materials.deck,
    );
    crossbeam.position.copy(worldPosition(direction, side, radial, lateral, deckY + 0.18));
    crossbeam.rotation.y = -angle;
    arm.add(crossbeam);

    const underSupport = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.72, taper * 0.72),
      materials.structure,
    );
    underSupport.position.copy(worldPosition(direction, side, radial, lateral, deckY - 0.52));
    underSupport.rotation.y = -angle;
    arm.add(underSupport);

    const joint = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.42, 0.18, 6),
      segmentIndex === segmentCenters.length - 1 ? pathGlow : materials.deck,
    );
    joint.position.copy(worldPosition(direction, side, radial + segmentLength * 0.43, lateral, deckY + 0.14));
    joint.rotation.y = Math.PI / 6;
    arm.add(joint);

    for (const sign of [-1, 1]) {
      const nodeLight = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.07 + (segmentIndex % 2) * 0.012, 0),
        entity.state === "risk" && segmentIndex >= 2 ? materials.amberGlow : materials.cyanGlow,
      );
      nodeLight.position.copy(worldPosition(direction, side, radial + (sign > 0 ? 0.37 : -0.37), lateral + sign * taper * 0.34, deckY + 0.22));
      nodeLight.name = `v5-arm-node-light-${entity.id}-${segmentIndex}-${sign > 0 ? "r" : "l"}`;
      arm.add(nodeLight);
    }

    if (quality === "cinematic") {
      const lowerTruss = new THREE.Mesh(
        new THREE.BoxGeometry(segmentLength * 0.84, 0.06, 0.06),
        materials.structureEdge,
      );
      lowerTruss.position.copy(worldPosition(direction, side, radial, lateral, deckY - 0.58));
      lowerTruss.rotation.set(0.08 * wave, -angle, 0.12 * wave);
      arm.add(lowerTruss);
    }
  });

  const endpoint = worldPosition(direction, side, 10.05, 0.04 * wave, 0);
  const curvePoints = [
    worldPosition(direction, side, 2.86, 0, 0.34),
    ...segmentCenters.map((radial, segmentIndex) => worldPosition(
      direction,
      side,
      radial,
      lateralOffsets[segmentIndex] * 0.56,
      0.39 + segmentIndex * 0.018,
    )),
    endpoint.clone().setY(0.54),
  ];
  const curve = new THREE.CatmullRomCurve3(curvePoints);

  const path = new THREE.Mesh(
    new THREE.TubeGeometry(
      curve,
      quality === "constrained" || quality === "reduced" ? 36 : 68,
      entity.state === "risk" ? 0.085 : 0.058,
      10,
      false,
    ),
    entity.state === "risk" ? materials.pathRisk : materials.pathHealthy,
  );
  path.name = `v5-path-${entity.id}`;
  path.userData.v5Curve = curve;
  path.userData.v5State = entity.state;
  arm.add(path);

  if (detailed) {
    const aura = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 52, entity.state === "risk" ? 0.16 : 0.12, 8, false),
      entity.state === "risk" ? materials.scanRisk : materials.scanTeal,
    );
    aura.name = `v5-path-aura-${entity.id}`;
    arm.add(aura);
  }

  const packetCount = quality === "cinematic" ? 4 : quality === "balanced" ? 3 : 1;
  for (let packetIndex = 0; packetIndex < packetCount; packetIndex += 1) {
    const pulse = new THREE.Mesh(
      new THREE.SphereGeometry(entity.state === "risk" ? 0.16 : 0.12, 14, 14),
      entity.state === "risk" ? materials.amberGlow : materials.cyanGlow,
    );
    const offset = (index * 0.11 + packetIndex / packetCount) % 1;
    pulse.position.copy(curve.getPoint(offset));
    pulse.name = `v5-pulse-${entity.id}-${packetIndex}`;
    pulse.userData.v5Curve = curve;
    pulse.userData.v5Offset = offset;
    pulse.userData.v5State = entity.state;
    arm.add(pulse);
  }

  const gateway = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.052, 10, 40), pathGlow);
  gateway.position.copy(worldPosition(direction, side, 9.66, 0.04 * wave, 0.54));
  gateway.rotation.x = Math.PI / 2;
  gateway.name = `v5-gateway-${entity.id}`;
  arm.add(gateway);

  arm.userData.v5Curve = curve;
  return Object.freeze({ group: arm, endpoint, angle, curve });
}
