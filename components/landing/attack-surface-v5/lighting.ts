import * as THREE from "three";

export function createV5Lighting(scene: THREE.Scene): THREE.Group {
  scene.fog = new THREE.FogExp2(0x05070a, 0.029);

  const lights = new THREE.Group();
  lights.name = "v5-lighting";

  const ambient = new THREE.AmbientLight(0x173033, 0.48);
  const hemisphere = new THREE.HemisphereLight(0x5ce2c9, 0x05070a, 0.68);
  const key = new THREE.DirectionalLight(0xe8fffb, 2.85);
  key.position.set(4.8, 11.5, 7.2);

  const cyanRim = new THREE.PointLight(0x38e4de, 25, 30, 2);
  cyanRim.position.set(-6.4, 4.4, -4.6);
  const tealFill = new THREE.PointLight(0x5ce2c9, 16, 25, 2);
  tealFill.position.set(5.6, 2.8, -5.2);

  // The two risk entities occupy opposite ends of the same scene axis.
  // Keeping dedicated orange lights there prevents healthy branches from reading as vulnerable.
  const riskWeb = new THREE.PointLight(0xff6a38, 19, 16, 2);
  riskWeb.position.set(0, 2.6, -9.2);
  const riskData = new THREE.PointLight(0xff6a38, 22, 17, 2);
  riskData.position.set(0, 2.4, 9.2);
  const amberCore = new THREE.PointLight(0xf8b45b, 7, 9, 2);
  amberCore.position.set(0, 2.2, 0);

  const underglow = new THREE.PointLight(0x38e4de, 13, 18, 2);
  underglow.position.set(0, -2.8, 0);

  lights.add(ambient, hemisphere, key, cyanRim, tealFill, riskWeb, riskData, amberCore, underglow);
  scene.add(lights);
  return lights;
}
