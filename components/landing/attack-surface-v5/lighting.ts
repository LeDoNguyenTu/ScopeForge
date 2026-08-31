import * as THREE from "three";

export function createV5Lighting(scene: THREE.Scene): THREE.Group {
  scene.fog = new THREE.FogExp2(0x05070a, 0.032);

  const lights = new THREE.Group();
  lights.name = "v5-lighting";

  const ambient = new THREE.AmbientLight(0x173033, 0.62);
  const hemisphere = new THREE.HemisphereLight(0x5ce2c9, 0x05070a, 0.76);
  const key = new THREE.DirectionalLight(0xd8fff8, 2.5);
  key.position.set(5.5, 10, 5.8);

  const cyanRim = new THREE.PointLight(0x38e4de, 24, 26, 2);
  cyanRim.position.set(-5.2, 4.2, -3.4);
  const tealFill = new THREE.PointLight(0x5ce2c9, 15, 22, 2);
  tealFill.position.set(4.8, 2.4, -5.4);
  const risk = new THREE.PointLight(0xff6a38, 18, 20, 2);
  risk.position.set(6.4, 2.2, 5.6);
  const underglow = new THREE.PointLight(0x38e4de, 12, 16, 2);
  underglow.position.set(0, -2.4, 0);

  lights.add(ambient, hemisphere, key, cyanRim, tealFill, risk, underglow);
  scene.add(lights);
  return lights;
}
