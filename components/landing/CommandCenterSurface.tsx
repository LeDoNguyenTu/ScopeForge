"use client";

import { useEffect, useRef, useState } from "react";
import ScopeForgeMark from "@/components/brand/ScopeForgeMark";

type RendererState = "fallback" | "webgl";
type RGB = readonly [number, number, number];
type Vec3 = readonly [number, number, number];

type Arm = Readonly<{
  angle: number;
  length: number;
  elevation: number;
  color: RGB;
  tower: number;
}>;

const TEAL: RGB = [0.29, 0.91, 0.78];
const CYAN: RGB = [0.34, 0.76, 0.84];
const RISK: RGB = [1, 0.35, 0.14];
const AMBER: RGB = [1, 0.67, 0.23];
const STEEL: RGB = [0.18, 0.37, 0.41];
const DIM_STEEL: RGB = [0.09, 0.2, 0.23];

const ARMS: readonly Arm[] = Object.freeze([
  { angle: -154, length: 2.35, elevation: -0.08, color: RISK, tower: 1 },
  { angle: -106, length: 2.05, elevation: 0.14, color: TEAL, tower: 2 },
  { angle: -57, length: 2.28, elevation: 0.22, color: TEAL, tower: 3 },
  { angle: -8, length: 2.48, elevation: -0.02, color: RISK, tower: 2 },
  { angle: 43, length: 2.2, elevation: 0.12, color: TEAL, tower: 2 },
  { angle: 99, length: 2.08, elevation: 0.03, color: TEAL, tower: 1 },
]);

const VERTEX_SHADER = `
attribute vec3 aPosition;
attribute vec3 aColor;
uniform vec2 uParallax;
uniform float uTime;
uniform float uPointSize;
uniform float uAspect;
varying vec3 vColor;

void main() {
  float yaw = uParallax.x * 0.18 + sin(uTime * 0.00012) * 0.028;
  float pitch = -0.66 + uParallax.y * 0.08;
  float cy = cos(yaw);
  float sy = sin(yaw);
  float cp = cos(pitch);
  float sp = sin(pitch);

  vec3 p = aPosition;
  p = vec3(
    p.x * cy - p.z * sy,
    p.y,
    p.x * sy + p.z * cy
  );
  p = vec3(
    p.x,
    p.y * cp - p.z * sp,
    p.y * sp + p.z * cp
  );

  p.y -= 0.05;
  p.z += 4.45;
  float perspective = 2.22 / max(1.65, p.z);
  vec2 projected = vec2(p.x * perspective / max(0.72, uAspect), p.y * perspective);

  gl_Position = vec4(projected, 0.0, 1.0);
  gl_PointSize = uPointSize * clamp(5.2 / p.z, 0.72, 1.45);
  vColor = aColor;
}
`;

const FRAGMENT_SHADER = `
precision mediump float;
varying vec3 vColor;
void main() {
  gl_FragColor = vec4(vColor, 0.88);
}
`;

function radialPoint(angle: number, radius: number, y = 0): Vec3 {
  const radians = (angle * Math.PI) / 180;
  return [Math.cos(radians) * radius, y, Math.sin(radians) * radius];
}

function addLine(
  positions: number[],
  colors: number[],
  from: Vec3,
  to: Vec3,
  color: RGB,
  strength = 1,
) {
  positions.push(from[0], from[1], from[2], to[0], to[1], to[2]);
  colors.push(
    color[0] * strength,
    color[1] * strength,
    color[2] * strength,
    color[0] * strength,
    color[1] * strength,
    color[2] * strength,
  );
}

function addRing(
  positions: number[],
  colors: number[],
  radius: number,
  y: number,
  color: RGB,
  strength: number,
  segments = 64,
) {
  for (let index = 0; index < segments; index += 1) {
    const a = (index / segments) * Math.PI * 2;
    const b = ((index + 1) / segments) * Math.PI * 2;
    addLine(
      positions,
      colors,
      [Math.cos(a) * radius, y, Math.sin(a) * radius],
      [Math.cos(b) * radius, y, Math.sin(b) * radius],
      color,
      strength,
    );
  }
}

function addBox(
  positions: number[],
  colors: number[],
  center: Vec3,
  size: Vec3,
  color: RGB,
  strength = 1,
) {
  const [cx, cy, cz] = center;
  const [sx, sy, sz] = [size[0] / 2, size[1] / 2, size[2] / 2];
  const corners: Vec3[] = [
    [cx - sx, cy - sy, cz - sz],
    [cx + sx, cy - sy, cz - sz],
    [cx + sx, cy + sy, cz - sz],
    [cx - sx, cy + sy, cz - sz],
    [cx - sx, cy - sy, cz + sz],
    [cx + sx, cy - sy, cz + sz],
    [cx + sx, cy + sy, cz + sz],
    [cx - sx, cy + sy, cz + sz],
  ];
  const edges = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ] as const;
  edges.forEach(([a, b]) => addLine(positions, colors, corners[a], corners[b], color, strength));
  addLine(positions, colors, corners[0], corners[6], color, strength * 0.3);
  addLine(positions, colors, corners[1], corners[7], color, strength * 0.3);
}

function armPoint(arm: Arm, radius: number, lateral = 0, vertical = 0): Vec3 {
  const radians = (arm.angle * Math.PI) / 180;
  const normalX = -Math.sin(radians);
  const normalZ = Math.cos(radians);
  const progress = Math.max(0, Math.min(1, (radius - 0.5) / Math.max(0.01, arm.length - 0.5)));
  return [
    Math.cos(radians) * radius + normalX * lateral,
    arm.elevation * progress + vertical,
    Math.sin(radians) * radius + normalZ * lateral,
  ];
}

function buildGeometry() {
  const linePositions: number[] = [];
  const lineColors: number[] = [];
  const pointPositions: number[] = [];
  const pointColors: number[] = [];

  addRing(linePositions, lineColors, 0.42, -0.08, STEEL, 0.7);
  addRing(linePositions, lineColors, 0.58, 0.02, CYAN, 0.55);
  addRing(linePositions, lineColors, 0.78, -0.02, STEEL, 0.46);
  addRing(linePositions, lineColors, 1.04, -0.09, DIM_STEEL, 0.5);
  addRing(linePositions, lineColors, 1.35, -0.13, DIM_STEEL, 0.34, 72);

  for (let index = 0; index < 12; index += 1) {
    const angle = (360 / 12) * index + 15;
    const inner = radialPoint(angle, 0.42, -0.08);
    const outer = radialPoint(angle, 0.78, -0.02);
    addLine(linePositions, lineColors, inner, outer, index % 3 === 0 ? CYAN : STEEL, index % 3 === 0 ? 0.46 : 0.28);
  }

  addBox(linePositions, lineColors, [0, 0.08, 0], [0.72, 0.28, 0.72], TEAL, 0.52);
  addBox(linePositions, lineColors, [0, 0.23, 0], [0.43, 0.16, 0.43], AMBER, 0.38);

  ARMS.forEach((arm, armIndex) => {
    const start = 0.52;
    const end = arm.length;
    const halfWidth = 0.16;
    const halfHeight = 0.105;

    const rails = [
      [-halfWidth, -halfHeight],
      [halfWidth, -halfHeight],
      [-halfWidth, halfHeight],
      [halfWidth, halfHeight],
    ] as const;

    rails.forEach(([lateral, vertical], railIndex) => {
      addLine(
        linePositions,
        lineColors,
        armPoint(arm, start, lateral, vertical),
        armPoint(arm, end, lateral, vertical),
        railIndex > 1 ? arm.color : STEEL,
        railIndex > 1 ? 0.72 : 0.44,
      );
    });

    const braces = 9;
    for (let step = 0; step <= braces; step += 1) {
      const t = step / braces;
      const radius = start + (end - start) * t;
      addLine(
        linePositions,
        lineColors,
        armPoint(arm, radius, -halfWidth, halfHeight),
        armPoint(arm, radius, halfWidth, halfHeight),
        step % 2 === 0 ? arm.color : STEEL,
        step % 2 === 0 ? 0.5 : 0.34,
      );
      addLine(
        linePositions,
        lineColors,
        armPoint(arm, radius, -halfWidth, -halfHeight),
        armPoint(arm, radius, halfWidth, -halfHeight),
        STEEL,
        0.3,
      );

      if (step < braces) {
        const nextRadius = start + (end - start) * ((step + 1) / braces);
        const fromSide = step % 2 === 0 ? -halfWidth : halfWidth;
        const toSide = -fromSide;
        addLine(
          linePositions,
          lineColors,
          armPoint(arm, radius, fromSide, halfHeight),
          armPoint(arm, nextRadius, toSide, halfHeight),
          armIndex === 0 || armIndex === 3 ? arm.color : STEEL,
          armIndex === 0 || armIndex === 3 ? 0.48 : 0.26,
        );
      }
    }

    const terminal = armPoint(arm, end, 0, 0.18);
    addBox(linePositions, lineColors, terminal, [0.52, 0.48, 0.52], arm.color, 0.76);
    addBox(linePositions, lineColors, [terminal[0], terminal[1] + 0.24, terminal[2]], [0.3, 0.14, 0.3], arm.color, 0.42);

    for (let level = 1; level < arm.tower; level += 1) {
      const towerCenter: Vec3 = [terminal[0], terminal[1] + level * 0.38, terminal[2]];
      addBox(linePositions, lineColors, towerCenter, [0.34 - level * 0.03, 0.28, 0.34 - level * 0.03], arm.color, 0.56);
      addLine(
        linePositions,
        lineColors,
        [terminal[0], terminal[1] + (level - 0.6) * 0.38, terminal[2]],
        [terminal[0], terminal[1] + (level + 0.25) * 0.38, terminal[2]],
        arm.color,
        0.42,
      );
    }
  });

  for (let index = 0; index < 86; index += 1) {
    const angle = ((index * 137.508) * Math.PI) / 180;
    const radius = 0.65 + ((index * 41) % 190) / 100;
    const height = -0.18 + ((index * 17) % 62) / 100;
    pointPositions.push(Math.cos(angle) * radius, height, Math.sin(angle) * radius);
    const color = index % 13 === 0 ? TEAL : index % 17 === 0 ? AMBER : DIM_STEEL;
    pointColors.push(color[0], color[1], color[2]);
  }

  return {
    linePositions: new Float32Array(linePositions),
    lineColors: new Float32Array(lineColors),
    pointPositions: new Float32Array(pointPositions),
    pointColors: new Float32Array(pointColors),
  };
}

function createShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("WEBGL_SHADER_UNAVAILABLE");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    throw new Error("WEBGL_SHADER_COMPILE_FAILED");
  }
  return shader;
}

function createProgram(gl: WebGLRenderingContext) {
  const vertex = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const program = gl.createProgram();
  if (!program) throw new Error("WEBGL_PROGRAM_UNAVAILABLE");
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    throw new Error("WEBGL_PROGRAM_LINK_FAILED");
  }
  return program;
}

const FALLBACK_ARMS = [
  "M50 50 L18 39",
  "M50 50 L31 17",
  "M50 50 L57 12",
  "M50 50 L88 37",
  "M50 50 L79 78",
  "M50 50 L38 86",
] as const;

export default function CommandCenterSurface() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const [rendererState, setRendererState] = useState<RendererState>("fallback");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let gl: WebGLRenderingContext | null = null;
    try {
      gl = canvas.getContext("webgl", {
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      }) as WebGLRenderingContext | null;
    } catch {
      return;
    }
    if (!gl) return;

    let program: WebGLProgram | null = null;
    let linePositionBuffer: WebGLBuffer | null = null;
    let lineColorBuffer: WebGLBuffer | null = null;
    let staticPointPositionBuffer: WebGLBuffer | null = null;
    let staticPointColorBuffer: WebGLBuffer | null = null;
    let pulsePositionBuffer: WebGLBuffer | null = null;
    let pulseColorBuffer: WebGLBuffer | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let frame = 0;
    let disposed = false;

    const releaseResources = () => {
      if (linePositionBuffer) gl!.deleteBuffer(linePositionBuffer);
      if (lineColorBuffer) gl!.deleteBuffer(lineColorBuffer);
      if (staticPointPositionBuffer) gl!.deleteBuffer(staticPointPositionBuffer);
      if (staticPointColorBuffer) gl!.deleteBuffer(staticPointColorBuffer);
      if (pulsePositionBuffer) gl!.deleteBuffer(pulsePositionBuffer);
      if (pulseColorBuffer) gl!.deleteBuffer(pulseColorBuffer);
      if (program) gl!.deleteProgram(program);
    };

    try {
      program = createProgram(gl);
      linePositionBuffer = gl.createBuffer();
      lineColorBuffer = gl.createBuffer();
      staticPointPositionBuffer = gl.createBuffer();
      staticPointColorBuffer = gl.createBuffer();
      pulsePositionBuffer = gl.createBuffer();
      pulseColorBuffer = gl.createBuffer();
      if (!linePositionBuffer || !lineColorBuffer || !staticPointPositionBuffer || !staticPointColorBuffer || !pulsePositionBuffer || !pulseColorBuffer) {
        throw new Error("WEBGL_BUFFER_UNAVAILABLE");
      }
    } catch {
      releaseResources();
      return;
    }

    const geometry = buildGeometry();
    const positionLocation = gl.getAttribLocation(program, "aPosition");
    const colorLocation = gl.getAttribLocation(program, "aColor");
    const parallaxLocation = gl.getUniformLocation(program, "uParallax");
    const timeLocation = gl.getUniformLocation(program, "uTime");
    const pointSizeLocation = gl.getUniformLocation(program, "uPointSize");
    const aspectLocation = gl.getUniformLocation(program, "uAspect");
    if (positionLocation < 0 || colorLocation < 0 || !parallaxLocation || !timeLocation || !pointSizeLocation || !aspectLocation) {
      releaseResources();
      return;
    }

    gl.useProgram(program);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.disable(gl.DEPTH_TEST);

    gl.bindBuffer(gl.ARRAY_BUFFER, linePositionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, geometry.linePositions, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, lineColorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, geometry.lineColors, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, staticPointPositionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, geometry.pointPositions, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, staticPointColorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, geometry.pointColors, gl.STATIC_DRAW);

    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    let aspect = 1;

    const bindAttribute = (buffer: WebGLBuffer, location: number, size: number) => {
      gl!.bindBuffer(gl!.ARRAY_BUFFER, buffer);
      gl!.enableVertexAttribArray(location);
      gl!.vertexAttribPointer(location, size, gl!.FLOAT, false, 0, 0);
    };

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.65);
      const width = Math.max(1, Math.round(bounds.width * dpr));
      const height = Math.max(1, Math.round(bounds.height * dpr));
      aspect = width / Math.max(1, height);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl!.viewport(0, 0, width, height);
    };

    const draw = (now: number) => {
      if (disposed) return;
      gl!.clearColor(0, 0, 0, 0);
      gl!.clear(gl!.COLOR_BUFFER_BIT);
      gl!.uniform2f(parallaxLocation, pointerRef.current.x, pointerRef.current.y);
      gl!.uniform1f(timeLocation, reducedMotion ? 0 : now);
      gl!.uniform1f(aspectLocation, aspect);

      bindAttribute(linePositionBuffer!, positionLocation, 3);
      bindAttribute(lineColorBuffer!, colorLocation, 3);
      gl!.uniform1f(pointSizeLocation, 1);
      gl!.drawArrays(gl!.LINES, 0, geometry.linePositions.length / 3);

      bindAttribute(staticPointPositionBuffer!, positionLocation, 3);
      bindAttribute(staticPointColorBuffer!, colorLocation, 3);
      gl!.uniform1f(pointSizeLocation, Math.min(4.5, 2.4 * Math.min(window.devicePixelRatio || 1, 1.65)));
      gl!.drawArrays(gl!.POINTS, 0, geometry.pointPositions.length / 3);

      const pulsePositions: number[] = [0, 0.3, 0];
      const pulseColors: number[] = [AMBER[0], AMBER[1], AMBER[2]];
      ARMS.forEach((arm, index) => {
        const phase = reducedMotion ? 0.72 : ((now * 0.00015 + index * 0.173) % 1 + 1) % 1;
        const radius = 0.56 + (arm.length - 0.56) * phase;
        const pulse = armPoint(arm, radius, 0, 0.16);
        pulsePositions.push(pulse[0], pulse[1], pulse[2]);
        pulseColors.push(arm.color[0], arm.color[1], arm.color[2]);
        const endPulse = armPoint(arm, arm.length, 0, 0.2);
        pulsePositions.push(endPulse[0], endPulse[1], endPulse[2]);
        pulseColors.push(arm.color[0], arm.color[1], arm.color[2]);
      });

      gl!.bindBuffer(gl!.ARRAY_BUFFER, pulsePositionBuffer);
      gl!.bufferData(gl!.ARRAY_BUFFER, new Float32Array(pulsePositions), gl!.DYNAMIC_DRAW);
      gl!.bindBuffer(gl!.ARRAY_BUFFER, pulseColorBuffer);
      gl!.bufferData(gl!.ARRAY_BUFFER, new Float32Array(pulseColors), gl!.DYNAMIC_DRAW);
      bindAttribute(pulsePositionBuffer!, positionLocation, 3);
      bindAttribute(pulseColorBuffer!, colorLocation, 3);
      gl!.uniform1f(pointSizeLocation, Math.min(11, 5.5 * Math.min(window.devicePixelRatio || 1, 1.65)));
      gl!.drawArrays(gl!.POINTS, 0, pulsePositions.length / 3);

      if (!reducedMotion && !document.hidden) frame = window.requestAnimationFrame(draw);
    };

    const onVisibility = () => {
      window.cancelAnimationFrame(frame);
      if (!document.hidden && !reducedMotion) frame = window.requestAnimationFrame(draw);
    };

    resize();
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(canvas);
    }
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibility);
    setRendererState("webgl");
    draw(performance.now());

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
      releaseResources();
    };
  }, []);

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    pointerRef.current = {
      x: ((event.clientX - bounds.left) / Math.max(1, bounds.width) - 0.5) * 2,
      y: -(((event.clientY - bounds.top) / Math.max(1, bounds.height) - 0.5) * 2),
    };
  };

  return (
    <div
      className="commandSurface"
      data-testid="command-center-surface"
      data-renderer-state={rendererState}
      data-scene-depth="3d"
      aria-label="Illustrative ScopeForge living attack surface"
      onPointerMove={onPointerMove}
      onPointerLeave={() => { pointerRef.current = { x: 0, y: 0 }; }}
    >
      <canvas ref={canvasRef} className="commandSurfaceCanvas" aria-hidden="true" />
      <svg className="commandSurfaceFallback" viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="12" />
        <circle cx="50" cy="50" r="21" />
        <circle cx="50" cy="50" r="31" strokeDasharray="1.1 1.8" />
        {FALLBACK_ARMS.map((path) => <path d={path} key={path} />)}
        <path d="M18 39l-4-3 1-6 7 1 3 5zM31 17l-4-5 3-6 7 2 2 6zM57 12l-3-6 4-5 6 3 1 6zM88 37l4-4 6 2-1 7-6 2zM79 78l5 2 1 6-6 3-5-4zM38 86l-5 3-5-4 1-6 6-1z" />
      </svg>

      <div className="commandSurfaceCore" aria-hidden="true">
        <span className="commandSurfaceCoreRing" />
        <ScopeForgeMark size={78} decorative />
      </div>

      <div className="commandSurfaceLabel commandSurfaceLabelWeb">
        <strong>WEB APPLICATION</strong>
        <span>2 Findings</span>
      </div>
      <div className="commandSurfaceLabel commandSurfaceLabelSandbox">
        <strong>SANDBOX</strong>
        <span>Isolated</span>
      </div>
      <div className="commandSurfaceLabel commandSurfaceLabelThird">
        <strong>THIRD PARTY</strong>
        <span>Monitored</span>
      </div>
      <div className="commandSurfaceLabel commandSurfaceLabelData">
        <strong>DATA STORE</strong>
        <span>At Risk</span>
      </div>
      <div className="commandSurfaceLabel commandSurfaceLabelIdentity">
        <strong>IDENTITY</strong>
        <span>Healthy</span>
      </div>
    </div>
  );
}
