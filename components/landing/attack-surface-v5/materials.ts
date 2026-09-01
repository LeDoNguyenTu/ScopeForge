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
  nanoTransition: THREE.ShaderMaterial;
}>;

function createNanoTransitionMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: false,
    depthWrite: true,
    side: THREE.DoubleSide,
    uniforms: {
      uProgress: { value: 0.42 },
      uTime: { value: 0 },
      uTeal: { value: new THREE.Color(0x38e4de) },
      uMetal: { value: new THREE.Color(0x8d9aa2) },
      uCarbon: { value: new THREE.Color(0x050709) },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      uniform float uProgress;
      uniform float uTime;

      float transitionBand(float x) {
        return 1.0 - smoothstep(0.035, 0.13, abs(x - uProgress));
      }

      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        float displacement = transitionBand(uv.x) * (0.025 + 0.018 * sin((uv.y * 34.0) + uTime * 1.7));
        vec3 displaced = position + normal * displacement;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      uniform float uProgress;
      uniform float uTime;
      uniform vec3 uTeal;
      uniform vec3 uMetal;
      uniform vec3 uCarbon;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 345.45));
        p += dot(p, p + 34.345);
        return fract(p.x * p.y);
      }

      float voronoi(vec2 p) {
        vec2 cell = floor(p);
        vec2 local = fract(p);
        float distanceToCell = 1.0;
        for (int y = -1; y <= 1; y++) {
          for (int x = -1; x <= 1; x++) {
            vec2 offset = vec2(float(x), float(y));
            vec2 jitter = vec2(hash21(cell + offset), hash21(cell + offset + 17.31));
            distanceToCell = min(distanceToCell, length(offset + jitter - local));
          }
        }
        return distanceToCell;
      }

      float hexGrid(vec2 p) {
        vec2 q = vec2(p.x * 1.1547, p.y + p.x * 0.57735);
        vec2 cell = abs(fract(q) - 0.5);
        return 1.0 - smoothstep(0.40, 0.49, max(cell.x, cell.y));
      }

      vec3 carbonWeave(vec2 uv) {
        float a = sin((uv.x + uv.y) * 150.0);
        float b = sin((uv.x - uv.y) * 150.0);
        float weave = 0.5 + 0.5 * a * b;
        return uCarbon + vec3(weave * 0.022);
      }

      vec3 metallicSurface(vec2 uv, vec3 normal) {
        float panel = step(0.91, fract(uv.x * 10.0)) + step(0.91, fract(uv.y * 7.0));
        float facing = 0.3 + 0.7 * abs(normal.z);
        return uMetal * (0.38 + facing * 0.42) + vec3(panel * 0.13);
      }

      void main() {
        float progressMask = smoothstep(uProgress - 0.055, uProgress + 0.055, vUv.x);
        float edge = 1.0 - smoothstep(0.028, 0.105, abs(vUv.x - uProgress));
        float cells = 1.0 - smoothstep(0.18, 0.56, voronoi(vUv * vec2(28.0, 18.0)));
        float hex = hexGrid(vUv * vec2(22.0, 16.0));
        float brokenEdge = edge * mix(0.35, 1.0, cells * hex);
        vec3 carbon = carbonWeave(vUv);
        vec3 metal = metallicSurface(vUv, normalize(vNormal));
        vec3 base = mix(carbon, metal, progressMask);
        vec3 emission = uTeal * brokenEdge * (1.3 + 0.35 * sin(uTime * 2.2 + vUv.y * 20.0));
        gl_FragColor = vec4(base + emission, 1.0);
      }
    `,
  });
}

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
  const nanoTransition = createNanoTransitionMaterial();

  return Object.freeze({ structure, deck, structureEdge, deckEdge, riskEdge, panel, glass, healthy, healthyGlow, cyanGlow, risk, riskGlow, amberGlow, pathHealthy, pathRisk, pending, scanTeal, scanRisk, nanoTransition });
}
