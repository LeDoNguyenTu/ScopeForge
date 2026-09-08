import * as THREE from "three";

export function createV5Lighting(scene: THREE.Scene): THREE.Group {
  scene.fog = new THREE.FogExp2(0x02090b, 0.045);

  const lights = new THREE.Group();
  lights.name = "v5-lighting";

  const ambient = new THREE.AmbientLight(0x16434a, 1.05);
  const key = new THREE.DirectionalLight(0x8cfaf3, 2.15);
  key.position.set(4, 8, 4);
  const rim = new THREE.PointLight(0x00d8d0, 18, 22, 2);
  rim.position.set(-4, 3.5, -2);
  const risk = new THREE.PointLight(0xff6c2f, 13, 17, 2);
  risk.position.set(5, 2.2, 5);

  lights.add(ambient, key, rim, risk);
  scene.add(lights);
  return lights;
}
