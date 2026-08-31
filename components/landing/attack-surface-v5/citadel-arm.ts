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

  const segmentLength = 1.46;
  const segmentCenters = [3.85, 5.34, 6.83];
  const pathGlow = entity.state === "risk" ? materials.riskGlow : materials.healthyGlow;

  segmentCenters.forEach((radial, segmentIndex) => {
    const bridge = new THREE.Mesh(
      new THREE.BoxGeometry(segmentLength, 0.2, 0.88 - segmentIndex * 0.05),
      segmentIndex % 2 === 0 ? materials.structure : materials.deck,
    );
    bridge.position.copy(worldPosition(direction, side, radial, 0, -0.03 - segmentIndex * 0.025));
    bridge.rotation.y = -angle;
    bridge.name = `v5-bridge-${entity.id}-${segmentIndex}`;
    arm.add(bridge);

    const wireDeck = new THREE.Mesh(
      new THREE.BoxGeometry(segmentLength * 0.94, 0.05, 0.78 - segmentIndex * 0.04),
      materials.deckEdge,
    );
    wireDeck.position.copy(worldPosition(direction, side, radial, 0, 0.11));
    wireDeck.rotation.y = -angle;
    arm.add(wireDeck);

    for (const sign of [-1, 1]) {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(segmentLength * 0.96, 0.055, 0.045),
        pathGlow,
      );
      rail.position.copy(worldPosition(direction, side, radial, sign * 0.41, 0.25));
      rail.rotation.y = -angle;
      arm.add(rail);

      if (quality === "cinematic" || quality === "balanced") {
        const upperBrace = new THREE.Mesh(
          new THREE.BoxGeometry(segmentLength * 0.78, 0.055, 0.055),
          materials.structureEdge,
        );
        upperBrace.position.copy(worldPosition(direction, side, radial, sign * 0.3, 0.43));
        upperBrace.rotation.set(sign * 0.08, -angle, sign * 0.1);
        arm.add(upperBrace);
      }
    }

    const crossbeam = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.08, 1.14),
      materials.deck,
    );
    crossbeam.position.copy(worldPosition(direction, side, radial, 0, 0.18));
    crossbeam.rotation.y = -angle;
    arm.add(crossbeam);

    const underSupport = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.62, 0.72),
      materials.structure,
    );
    underSupport.position.copy(worldPosition(direction, side, radial, 0, -0.38 - segmentIndex * 0.04));
    underSupport.rotation.y = -angle;
    arm.add(underSupport);

    if (quality === "cinematic") {
      for (const sign of [-1, 1]) {
        const lowerRib = new THREE.Mesh(
          new THREE.BoxGeometry(segmentLength * 0.72, 0.045, 0.045),
          materials.structureEdge,
        );
        lowerRib.position.copy(worldPosition(direction, side, radial, sign * 0.32, -0.42));
        lowerRib.rotation.set(sign * -0.08, -angle, sign * -0.12);
        arm.add(lowerRib);
      }
    }
  });

  const endpoint = direction.clone().multiplyScalar(8.15);
  const curve = new THREE.CatmullRomCurve3([
    direction.clone().multiplyScalar(2.9).setY(0.31),
    worldPosition(direction, side, 4.35, (index % 2 ? -1 : 1) * 0.22, 0.36),
    worldPosition(direction, side, 6.15, (index % 3 - 1) * 0.28, 0.42),
    endpoint.clone().setY(0.5),
  ]);

  const path = new THREE.Mesh(
    new THREE.TubeGeometry(
      curve,
      quality === "constrained" || quality === "reduced" ? 28 : 48,
      entity.state === "risk" ? 0.075 : 0.052,
      8,
      false,
    ),
    entity.state === "risk" ? materials.pathRisk : materials.pathHealthy,
  );
  path.name = `v5-path-${entity.id}`;
  path.userData.v5Curve = curve;
  path.userData.v5State = entity.state;
  arm.add(path);

  const packetCount = quality === "cinematic" ? 3 : quality === "balanced" ? 2 : 1;
  for (let packetIndex = 0; packetIndex < packetCount; packetIndex += 1) {
    const pulse = new THREE.Mesh(
      new THREE.SphereGeometry(entity.state === "risk" ? 0.15 : 0.115, 12, 12),
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

  const gateway = new THREE.Mesh(
    new THREE.TorusGeometry(0.48, 0.045, 8, 32),
    pathGlow,
  );
  gateway.position.copy(direction.clone().multiplyScalar(7.62).setY(0.5));
  gateway.rotation.x = Math.PI / 2;
  gateway.name = `v5-gateway-${entity.id}`;
  arm.add(gateway);

  arm.userData.v5Curve = curve;
  return Object.freeze({ group: arm, endpoint, angle, curve });
}
