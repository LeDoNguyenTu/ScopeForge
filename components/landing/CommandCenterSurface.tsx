"use client";

import { useEffect, useRef, useState } from "react";
import ScopeForgeMark from "@/components/brand/ScopeForgeMark";

type RendererState = "fallback" | "webgl";
type RGB = readonly [number, number, number];
type Vec2 = readonly [number, number];

const TEAL: RGB = [0.29, 0.91, 0.78];
const CYAN: RGB = [0.34, 0.76, 0.84];
const RISK: RGB = [1, 0.35, 0.14];
const AMBER: RGB = [1, 0.67, 0.23];
const STEEL: RGB = [0.18, 0.37, 0.41];

const arms = [
  { angle: -154, length: 0.94, color: RISK },
  { angle: -109, length: 0.82, color: TEAL },
  { angle: -63, length: 0.9, color: TEAL },
  { angle: -12, length: 0.98, color: RISK },
  { angle: 43, length: 0.9, color: TEAL },
  { angle: 98, length: 0.83, color: TEAL },
] as const;

const VERTEX_SHADER = `
attribute vec2 aPosition;
attribute vec3 aColor;
uniform vec2 uParallax;
uniform float uPointSize;
varying vec3 vColor;
void main() {
  vec2 shifted = aPosition + uParallax * (0.025 + abs(aPosition.y) * 0.016);
  gl_Position = vec4(shifted, 0.0, 1.0);
  gl_PointSize = uPointSize;
  vColor = aColor;
}
`;

const FRAGMENT_SHADER = `
precision mediump float;
varying vec3 vColor;
void main() {
  gl_FragColor = vec4(vColor, 0.86);
}
`;

function endpoint(angle: number, length: number): Vec2 {
  const r = (angle * Math.PI) / 180;
  return [Math.cos(r) * length, Math.sin(r) * length * 0.72];
}

function addLine(positions: number[], colors: number[], from: Vec2, to: Vec2, color: RGB, strength = 1) {
  positions.push(from[0], from[1], to[0], to[1]);
  colors.push(
    color[0] * strength,
    color[1] * strength,
    color[2] * strength,
    color[0] * strength,
    color[1] * strength,
    color[2] * strength,
  );
}

function buildStaticGeometry() {
  const positions: number[] = [];
  const colors: number[] = [];

  for (const radius of [0.16, 0.27, 0.38]) {
    const segments = 64;
    for (let index = 0; index < segments; index += 1) {
      const a = (index / segments) * Math.PI * 2;
      const b = ((index + 1) / segments) * Math.PI * 2;
      addLine(
        positions,
        colors,
        [Math.cos(a) * radius, Math.sin(a) * radius * 0.74],
        [Math.cos(b) * radius, Math.sin(b) * radius * 0.74],
        index % 5 === 0 ? CYAN : STEEL,
        index % 5 === 0 ? 0.48 : 0.3,
      );
    }
  }

  arms.forEach((arm, armIndex) => {
    const end = endpoint(arm.angle, arm.length);
    const radians = (arm.angle * Math.PI) / 180;
    const normal: Vec2 = [-Math.sin(radians) * 0.045, Math.cos(radians) * 0.045];
    const inner: Vec2 = [Math.cos(radians) * 0.21, Math.sin(radians) * 0.21 * 0.72];

    addLine(positions, colors, inner, end, arm.color, 0.72);
    addLine(
      positions,
      colors,
      [inner[0] + normal[0], inner[1] + normal[1]],
      [end[0] + normal[0], end[1] + normal[1]],
      STEEL,
      0.56,
    );
    addLine(
      positions,
      colors,
      [inner[0] - normal[0], inner[1] - normal[1]],
      [end[0] - normal[0], end[1] - normal[1]],
      STEEL,
      0.56,
    );

    for (let step = 1; step < 8; step += 1) {
      const t = step / 8;
      const center: Vec2 = [
        inner[0] + (end[0] - inner[0]) * t,
        inner[1] + (end[1] - inner[1]) * t,
      ];
      const span = 0.024 + t * 0.026;
      addLine(
        positions,
        colors,
        [center[0] - normal[0] * (span / 0.045), center[1] - normal[1] * (span / 0.045)],
        [center[0] + normal[0] * (span / 0.045), center[1] + normal[1] * (span / 0.045)],
        armIndex === 0 || armIndex === 3 ? arm.color : STEEL,
        0.45,
      );
    }

    const cube = 0.075;
    const x = end[0];
    const y = end[1];
    const corners: Vec2[] = [
      [x - cube, y - cube * 0.65],
      [x + cube, y - cube * 0.65],
      [x + cube, y + cube * 0.65],
      [x - cube, y + cube * 0.65],
    ];
    corners.forEach((corner, index) => addLine(positions, colors, corner, corners[(index + 1) % 4], arm.color, 0.72));
    addLine(positions, colors, corners[0], corners[2], arm.color, 0.28);
    addLine(positions, colors, corners[1], corners[3], arm.color, 0.28);
  });

  for (let index = 0; index < 46; index += 1) {
    const a = ((index * 137.508) * Math.PI) / 180;
    const radius = 0.22 + ((index * 37) % 62) / 100;
    const x = Math.cos(a) * radius;
    const y = Math.sin(a) * radius * 0.72;
    addLine(positions, colors, [x, y], [x + 0.006, y + 0.004], index % 9 === 0 ? TEAL : STEEL, 0.5);
  }

  return {
    positions: new Float32Array(positions),
    colors: new Float32Array(colors),
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

const fallbackArms = [
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
      gl = canvas.getContext("webgl", { alpha: true, antialias: true, powerPreference: "high-performance" }) as WebGLRenderingContext | null;
    } catch {
      return;
    }
    if (!gl) return;

    let program: WebGLProgram | null = null;
    let staticPositionBuffer: WebGLBuffer | null = null;
    let staticColorBuffer: WebGLBuffer | null = null;
    let pulsePositionBuffer: WebGLBuffer | null = null;
    let pulseColorBuffer: WebGLBuffer | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let frame = 0;
    let disposed = false;

    try {
      program = createProgram(gl);
      staticPositionBuffer = gl.createBuffer();
      staticColorBuffer = gl.createBuffer();
      pulsePositionBuffer = gl.createBuffer();
      pulseColorBuffer = gl.createBuffer();
      if (!staticPositionBuffer || !staticColorBuffer || !pulsePositionBuffer || !pulseColorBuffer) throw new Error("WEBGL_BUFFER_UNAVAILABLE");
    } catch {
      if (program) gl.deleteProgram(program);
      return;
    }

    const geometry = buildStaticGeometry();
    const positionLocation = gl.getAttribLocation(program, "aPosition");
    const colorLocation = gl.getAttribLocation(program, "aColor");
    const parallaxLocation = gl.getUniformLocation(program, "uParallax");
    const pointSizeLocation = gl.getUniformLocation(program, "uPointSize");
    if (positionLocation < 0 || colorLocation < 0 || !parallaxLocation || !pointSizeLocation) return;

    gl.useProgram(program);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.disable(gl.DEPTH_TEST);

    gl.bindBuffer(gl.ARRAY_BUFFER, staticPositionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, geometry.positions, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, staticColorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, geometry.colors, gl.STATIC_DRAW);

    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

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
      const drift = reducedMotion ? 0 : Math.sin(now * 0.00022) * 0.012;
      gl!.uniform2f(parallaxLocation, pointerRef.current.x * 0.045 + drift, pointerRef.current.y * 0.038 - drift * 0.3);

      bindAttribute(staticPositionBuffer!, positionLocation, 2);
      bindAttribute(staticColorBuffer!, colorLocation, 3);
      gl!.uniform1f(pointSizeLocation, 1);
      gl!.drawArrays(gl!.LINES, 0, geometry.positions.length / 2);

      const pulsePositions: number[] = [0, 0];
      const pulseColors: number[] = [1, 0.67, 0.23];
      arms.forEach((arm, index) => {
        const end = endpoint(arm.angle, arm.length);
        const phase = reducedMotion ? 0.72 : ((now * 0.00018 + index * 0.19) % 1 + 1) % 1;
        pulsePositions.push(end[0] * phase, end[1] * phase);
        pulseColors.push(...arm.color);
        pulsePositions.push(end[0], end[1]);
        pulseColors.push(...arm.color);
      });

      gl!.bindBuffer(gl!.ARRAY_BUFFER, pulsePositionBuffer);
      gl!.bufferData(gl!.ARRAY_BUFFER, new Float32Array(pulsePositions), gl!.DYNAMIC_DRAW);
      gl!.bindBuffer(gl!.ARRAY_BUFFER, pulseColorBuffer);
      gl!.bufferData(gl!.ARRAY_BUFFER, new Float32Array(pulseColors), gl!.DYNAMIC_DRAW);
      bindAttribute(pulsePositionBuffer!, positionLocation, 2);
      bindAttribute(pulseColorBuffer!, colorLocation, 3);
      gl!.uniform1f(pointSizeLocation, Math.min(11, 5 * Math.min(window.devicePixelRatio || 1, 1.65)));
      gl!.drawArrays(gl!.POINTS, 0, pulsePositions.length / 2);

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
      if (staticPositionBuffer) gl!.deleteBuffer(staticPositionBuffer);
      if (staticColorBuffer) gl!.deleteBuffer(staticColorBuffer);
      if (pulsePositionBuffer) gl!.deleteBuffer(pulsePositionBuffer);
      if (pulseColorBuffer) gl!.deleteBuffer(pulseColorBuffer);
      if (program) gl!.deleteProgram(program);
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
      aria-label="Illustrative ScopeForge living attack surface"
      onPointerMove={onPointerMove}
      onPointerLeave={() => { pointerRef.current = { x: 0, y: 0 }; }}
    >
      <canvas ref={canvasRef} className="commandSurfaceCanvas" aria-hidden="true" />
      <svg className="commandSurfaceFallback" viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="15" />
        <circle cx="50" cy="50" r="25" />
        {fallbackArms.map((path) => <path d={path} key={path} />)}
      </svg>
      <div className="commandSurfaceCore" aria-hidden="true">
        <span className="commandSurfaceCoreRing" />
        <ScopeForgeMark size={72} />
      </div>
      <div className="commandSurfaceLabel commandSurfaceLabelSandbox"><strong>SANDBOX</strong><span>Isolated</span></div>
      <div className="commandSurfaceLabel commandSurfaceLabelThird"><strong>THIRD PARTY</strong><span>Monitored</span></div>
      <div className="commandSurfaceLabel commandSurfaceLabelWeb"><strong>WEB APPLICATION</strong><span>2 Findings</span></div>
      <div className="commandSurfaceLabel commandSurfaceLabelData"><strong>DATA STORE</strong><span>At Risk</span></div>
      <div className="commandSurfaceLabel commandSurfaceLabelIdentity"><strong>IDENTITY</strong><span>Healthy</span></div>
    </div>
  );
}
