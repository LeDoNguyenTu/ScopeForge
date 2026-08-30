"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ScopeForgeMark from "@/components/brand/ScopeForgeMark";
import type {
  AttackSurfaceModel,
  AttackSurfaceNode,
  AttackSurfaceNodeState,
} from "@/lib/dashboard/attack-surface-model";

type RendererState = "fallback" | "webgl";

type RGB = readonly [number, number, number];

const STATE_COLOR: Readonly<Record<AttackSurfaceNodeState, RGB>> = Object.freeze({
  healthy: [0.31, 0.88, 0.76],
  pending: [0.94, 0.68, 0.27],
  risk: [1, 0.36, 0.17],
});

const VERTEX_SHADER = `
attribute vec2 aPosition;
attribute vec3 aColor;
uniform vec2 uParallax;
uniform float uPointSize;
varying vec3 vColor;
void main() {
  vec2 shifted = aPosition + uParallax * (0.035 + abs(aPosition.y) * 0.025);
  gl_Position = vec4(shifted, 0.0, 1.0);
  gl_PointSize = uPointSize;
}
`;

const FRAGMENT_SHADER = `
precision mediump float;
varying vec3 vColor;
void main() {
  gl_FragColor = vec4(vColor, 0.86);
}
`;

interface Geometry {
  linePositions: Float32Array;
  lineColors: Float32Array;
  nodePositions: readonly [number, number][];
  nodeColors: readonly RGB[];
}

function polarPosition(node: AttackSurfaceNode): [number, number] {
  const radians = (node.angle * Math.PI) / 180;
  return [
    Math.cos(radians) * node.radius * 0.88,
    Math.sin(radians) * node.radius * 0.72,
  ];
}

function pushLine(
  positions: number[],
  colors: number[],
  from: readonly [number, number],
  to: readonly [number, number],
  color: RGB,
  opacityScale = 1,
) {
  positions.push(from[0], from[1], to[0], to[1]);
  colors.push(
    color[0] * opacityScale,
    color[1] * opacityScale,
    color[2] * opacityScale,
    color[0] * opacityScale,
    color[1] * opacityScale,
    color[2] * opacityScale,
  );
}

function buildGeometry(nodes: readonly AttackSurfaceNode[]): Geometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const neutral: RGB = [0.18, 0.43, 0.48];

  for (const radius of [0.2, 0.39, 0.61]) {
    const segments = 48;
    for (let index = 0; index < segments; index += 1) {
      const a = (index / segments) * Math.PI * 2;
      const b = ((index + 1) / segments) * Math.PI * 2;
      pushLine(
        positions,
        colors,
        [Math.cos(a) * radius, Math.sin(a) * radius * 0.78],
        [Math.cos(b) * radius, Math.sin(b) * radius * 0.78],
        neutral,
        radius === 0.61 ? 0.48 : 0.32,
      );
    }
  }

  const nodePositions: [number, number][] = [];
  const nodeColors: RGB[] = [];

  for (const node of nodes) {
    const position = polarPosition(node);
    const color = STATE_COLOR[node.state];
    nodePositions.push(position);
    nodeColors.push(color);
    pushLine(positions, colors, [0, 0], position, color, 0.72);

    const tangent: [number, number] = [-position[1], position[0]];
    const tangentLength = Math.max(0.0001, Math.hypot(tangent[0], tangent[1]));
    const nx = (tangent[0] / tangentLength) * 0.065;
    const ny = (tangent[1] / tangentLength) * 0.065;
    const radialLength = Math.max(0.0001, Math.hypot(position[0], position[1]));
    const rx = (position[0] / radialLength) * 0.055;
    const ry = (position[1] / radialLength) * 0.055;
    const a: [number, number] = [position[0] - nx - rx, position[1] - ny - ry];
    const b: [number, number] = [position[0] + nx - rx, position[1] + ny - ry];
    const c: [number, number] = [position[0] + nx + rx, position[1] + ny + ry];
    const d: [number, number] = [position[0] - nx + rx, position[1] - ny + ry];
    pushLine(positions, colors, a, b, color, 0.72);
    pushLine(positions, colors, b, c, color, 0.72);
    pushLine(positions, colors, c, d, color, 0.72);
    pushLine(positions, colors, d, a, color, 0.72);

    const branchOrigin: [number, number] = [position[0] * 0.7, position[1] * 0.7];
    pushLine(
      positions,
      colors,
      branchOrigin,
      [branchOrigin[0] + nx * 1.5, branchOrigin[1] + ny * 1.5],
      color,
      0.38,
    );
  }

  return {
    linePositions: new Float32Array(positions),
    lineColors: new Float32Array(colors),
    nodePositions,
    nodeColors,
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

function labelPosition(node: AttackSurfaceNode) {
  const [x, y] = polarPosition(node);
  return {
    left: `${50 + x * 47}%`,
    top: `${50 - y * 52}%`,
  };
}

function nodeStatus(node: AttackSurfaceNode) {
  if (node.state === "risk") {
    return `${node.findingCount} active finding${node.findingCount === 1 ? "" : "s"}`;
  }
  if (node.state === "pending") return "Verification pending";
  return "Verified scope";
}

export default function WebGLAttackSurface({ model }: { model: AttackSurfaceModel }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const [rendererState, setRendererState] = useState<RendererState>("fallback");
  const geometry = useMemo(() => buildGeometry(model.nodes), [model.nodes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || model.nodes.length === 0) return;

    let gl: WebGLRenderingContext | null = null;
    try {
      gl = canvas.getContext("webgl", {
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      }) as WebGLRenderingContext | null;
    } catch {
      setRendererState("fallback");
      return;
    }
    if (!gl) {
      setRendererState("fallback");
      return;
    }

    let program: WebGLProgram | null = null;
    let linePositionBuffer: WebGLBuffer | null = null;
    let lineColorBuffer: WebGLBuffer | null = null;
    let pointPositionBuffer: WebGLBuffer | null = null;
    let pointColorBuffer: WebGLBuffer | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let frame = 0;
    let disposed = false;

    const releaseResources = () => {
      if (linePositionBuffer) gl!.deleteBuffer(linePositionBuffer);
      if (lineColorBuffer) gl!.deleteBuffer(lineColorBuffer);
      if (pointPositionBuffer) gl!.deleteBuffer(pointPositionBuffer);
      if (pointColorBuffer) gl!.deleteBuffer(pointColorBuffer);
      if (program) gl!.deleteProgram(program);
    };

    try {
      program = createProgram(gl);
      linePositionBuffer = gl.createBuffer();
      lineColorBuffer = gl.createBuffer();
      pointPositionBuffer = gl.createBuffer();
      pointColorBuffer = gl.createBuffer();
      if (!linePositionBuffer || !lineColorBuffer || !pointPositionBuffer || !pointColorBuffer) {
        throw new Error("WEBGL_BUFFER_UNAVAILABLE");
      }
    } catch {
      setRendererState("fallback");
      releaseResources();
      return;
    }

    const positionLocation = gl.getAttribLocation(program, "aPosition");
    const colorLocation = gl.getAttribLocation(program, "aColor");
    const parallaxLocation = gl.getUniformLocation(program, "uParallax");
    const pointSizeLocation = gl.getUniformLocation(program, "uPointSize");
    if (positionLocation < 0 || colorLocation < 0 || !parallaxLocation || !pointSizeLocation) {
      setRendererState("fallback");
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

    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      const width = Math.max(1, Math.round(bounds.width * dpr));
      const height = Math.max(1, Math.round(bounds.height * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl!.viewport(0, 0, width, height);
    };

    const bindAttribute = (buffer: WebGLBuffer, location: number, size: number) => {
      gl!.bindBuffer(gl!.ARRAY_BUFFER, buffer);
      gl!.enableVertexAttribArray(location);
      gl!.vertexAttribPointer(location, size, gl!.FLOAT, false, 0, 0);
    };

    const draw = (now: number) => {
      if (disposed) return;
      gl!.clearColor(0, 0, 0, 0);
      gl!.clear(gl!.COLOR_BUFFER_BIT);
      const drift = reducedMotion ? 0 : Math.sin(now * 0.00018) * 0.018;
      gl!.uniform2f(
        parallaxLocation,
        pointerRef.current.x * 0.055 + drift,
        pointerRef.current.y * 0.045 - drift * 0.4,
      );

      bindAttribute(linePositionBuffer!, positionLocation, 2);
      bindAttribute(lineColorBuffer!, colorLocation, 3);
      gl!.uniform1f(pointSizeLocation, 1);
      gl!.drawArrays(gl!.LINES, 0, geometry.linePositions.length / 2);

      const positions: number[] = [0, 0];
      const colors: number[] = [0.55, 0.98, 0.88];
      geometry.nodePositions.forEach((position, index) => {
        positions.push(position[0], position[1]);
        const color = geometry.nodeColors[index];
        colors.push(color[0], color[1], color[2]);
        if (!reducedMotion) {
          const phase = ((now * 0.00018 + index * 0.173) % 1 + 1) % 1;
          positions.push(position[0] * phase, position[1] * phase);
          colors.push(color[0], color[1], color[2]);
        }
      });

      gl!.bindBuffer(gl!.ARRAY_BUFFER, pointPositionBuffer);
      gl!.bufferData(gl!.ARRAY_BUFFER, new Float32Array(positions), gl!.DYNAMIC_DRAW);
      gl!.bindBuffer(gl!.ARRAY_BUFFER, pointColorBuffer);
      gl!.bufferData(gl!.ARRAY_BUFFER, new Float32Array(colors), gl!.DYNAMIC_DRAW);
      bindAttribute(pointPositionBuffer!, positionLocation, 2);
      bindAttribute(pointColorBuffer!, colorLocation, 3);
      gl!.uniform1f(pointSizeLocation, Math.min(10, 4 * Math.min(window.devicePixelRatio || 1, 1.75)));
      gl!.drawArrays(gl!.POINTS, 0, positions.length / 2);

      if (!reducedMotion && !document.hidden) {
        frame = window.requestAnimationFrame(draw);
      }
    };

    const onVisibility = () => {
      if (document.hidden) {
        window.cancelAnimationFrame(frame);
      } else if (!reducedMotion) {
        window.cancelAnimationFrame(frame);
        frame = window.requestAnimationFrame(draw);
      }
    };

    resize();
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(canvas);
    }

    setRendererState("webgl");
    draw(performance.now());
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("resize", resize);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", resize);
      releaseResources();
    };
  }, [geometry, model.nodes.length]);

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    pointerRef.current = {
      x: ((event.clientX - bounds.left) / Math.max(1, bounds.width) - 0.5) * 2,
      y: -(((event.clientY - bounds.top) / Math.max(1, bounds.height) - 0.5) * 2),
    };
  };

  const onPointerLeave = () => {
    pointerRef.current = { x: 0, y: 0 };
  };

  return (
    <div
      className="webglAttackSurface"
      data-testid="webgl-attack-surface"
      data-renderer-state={rendererState}
      aria-label="Workspace attack surface topology"
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
    >
      <canvas ref={canvasRef} className="webglAttackCanvas" aria-hidden="true" />
      <div className="webglAttackFallback" aria-hidden="true">
        <span className="webglFallbackRing webglFallbackRingOne" />
        <span className="webglFallbackRing webglFallbackRingTwo" />
        <span className="webglFallbackRing webglFallbackRingThree" />
      </div>
      <div className="webglAttackCore" aria-hidden="true">
        <span className="webglCoreHalo" />
        <span className="webglCoreOrbit" />
        <ScopeForgeMark size={74} />
      </div>

      {model.nodes.map((node) => (
        <div
          className={`webglAttackLabel webglAttackLabel-${node.state}`}
          key={node.id}
          style={labelPosition(node)}
        >
          <span className="webglAttackLabelKind">{node.kind.replaceAll("_", " ")}</span>
          <strong>{node.label}</strong>
          <small>{nodeStatus(node)}</small>
        </div>
      ))}

      {model.nodes.length === 0 ? (
        <div className="webglAttackEmpty">
          <ScopeForgeMark size={58} />
          <strong>No verified attack surface yet</strong>
          <span>Add and verify your first asset to build this workspace map.</span>
        </div>
      ) : null}
    </div>
  );
}
