import { QUALITY_PROFILES, type AttackSurfaceQuality } from "@/components/landing/attack-surface/constants";
import { createAttackSurfaceGeometry } from "@/components/landing/attack-surface/geometry";
import { getParallaxStrength, particleDrift, pulseSampleIndex, smoothPointer, type PointerState } from "@/components/landing/attack-surface/animation";

export type SceneMilestone = "capability" | "geometry" | "materials";

export type AttackSurfaceController = Readonly<{
  render: (timeMs: number) => void;
  resize: (width: number, height: number, dpr: number) => void;
  setPointer: (x: number, y: number) => void;
  setVisible: (visible: boolean) => void;
  dispose: () => void;
  firstFrame: Promise<void>;
}>;

export type CreateAttackSurfaceSceneOptions = Readonly<{
  canvas: HTMLCanvasElement;
  quality: AttackSurfaceQuality;
  onMilestone?: (milestone: SceneMilestone) => void;
}>;

type ProgramBundle = Readonly<{
  program: WebGLProgram;
  position: number;
  color: number;
  extra: number;
  time: WebGLUniformLocation | null;
  pointer: WebGLUniformLocation | null;
  aspect: WebGLUniformLocation | null;
  parallax: WebGLUniformLocation | null;
  alpha: WebGLUniformLocation | null;
  pointSize?: WebGLUniformLocation | null;
  drift?: WebGLUniformLocation | null;
}>;

type BufferBundle = Readonly<{
  position: WebGLBuffer;
  color: WebGLBuffer;
  extra: WebGLBuffer;
  count: number;
}>;

const GEOMETRY_VERTEX = `
attribute vec3 aPosition;
attribute vec3 aColor;
attribute float aExtra;
uniform float uTime;
uniform vec2 uPointer;
uniform float uAspect;
uniform float uParallax;
varying vec3 vColor;
varying float vPulse;

vec3 rotateY(vec3 p, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return vec3(p.x * c - p.z * s, p.y, p.x * s + p.z * c);
}

vec3 rotateX(vec3 p, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return vec3(p.x, p.y * c - p.z * s, p.y * s + p.z * c);
}

void main() {
  vec3 p = aPosition;
  if (aExtra > 0.5 && aExtra < 2.5) {
    float ringDirection = aExtra < 1.5 ? 1.0 : -1.0;
    p = rotateY(p, uTime * 0.000035 * ringDirection);
  }

  float yaw = uPointer.x * uParallax + sin(uTime * 0.00013) * 0.035;
  float pitch = -0.61 + uPointer.y * uParallax * 0.34;
  p = rotateY(p, yaw);
  p = rotateX(p, pitch);

  p.y -= 0.04;
  p.z += 5.15;
  float perspective = 2.55 / max(2.0, p.z);
  vec2 projected = vec2(p.x * perspective / max(0.72, uAspect), p.y * perspective);
  gl_Position = vec4(projected, 0.0, 1.0);

  float shimmer = aExtra >= 3.0 ? sin(uTime * 0.0011 + aExtra * 1.71) * 0.5 + 0.5 : 0.35;
  vPulse = 0.88 + shimmer * 0.12;
  vColor = aColor;
}
`;

const GEOMETRY_FRAGMENT = `
precision mediump float;
uniform float uAlpha;
varying vec3 vColor;
varying float vPulse;
void main() {
  gl_FragColor = vec4(vColor * vPulse, uAlpha);
}
`;

const POINT_VERTEX = `
attribute vec3 aPosition;
attribute vec3 aColor;
attribute float aExtra;
uniform float uTime;
uniform vec2 uPointer;
uniform float uAspect;
uniform float uParallax;
uniform float uPointSize;
uniform float uDrift;
varying vec3 vColor;

vec3 rotateY(vec3 p, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return vec3(p.x * c - p.z * s, p.y, p.x * s + p.z * c);
}

vec3 rotateX(vec3 p, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return vec3(p.x, p.y * c - p.z * s, p.y * s + p.z * c);
}

void main() {
  vec3 p = aPosition;
  if (uDrift > 0.5) {
    float wave = sin(uTime * 0.00022 + aExtra * 6.28318);
    p.y += wave * 0.035;
    p = rotateY(p, wave * 0.008);
  }

  float yaw = uPointer.x * uParallax + sin(uTime * 0.00013) * 0.035;
  float pitch = -0.61 + uPointer.y * uParallax * 0.34;
  p = rotateY(p, yaw);
  p = rotateX(p, pitch);
  p.z += 5.15;
  float perspective = 2.55 / max(2.0, p.z);
  vec2 projected = vec2(p.x * perspective / max(0.72, uAspect), p.y * perspective);
  gl_Position = vec4(projected, 0.0, 1.0);
  gl_PointSize = uPointSize * clamp(5.5 / p.z, 0.7, 1.6);
  vColor = aColor;
}
`;

const POINT_FRAGMENT = `
precision mediump float;
uniform float uAlpha;
varying vec3 vColor;
void main() {
  vec2 q = gl_PointCoord - vec2(0.5);
  float distanceToCenter = length(q);
  float core = 1.0 - smoothstep(0.05, 0.24, distanceToCenter);
  float glow = 1.0 - smoothstep(0.12, 0.5, distanceToCenter);
  float alpha = (core + glow * 0.6) * uAlpha;
  if (alpha <= 0.01) discard;
  gl_FragColor = vec4(vColor * (1.0 + core * 0.7), alpha);
}
`;

function createShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("WEBGL_SHADER_UNAVAILABLE");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) || "unknown shader compile error";
    gl.deleteShader(shader);
    throw new Error(`WEBGL_SHADER_COMPILE_FAILED:${log}`);
  }
  return shader;
}

function createProgram(gl: WebGLRenderingContext, vertexSource: string, fragmentSource: string, point = false): ProgramBundle {
  const vertex = createShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!program) throw new Error("WEBGL_PROGRAM_UNAVAILABLE");
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) || "unknown program link error";
    gl.deleteProgram(program);
    throw new Error(`WEBGL_PROGRAM_LINK_FAILED:${log}`);
  }

  return {
    program,
    position: gl.getAttribLocation(program, "aPosition"),
    color: gl.getAttribLocation(program, "aColor"),
    extra: gl.getAttribLocation(program, "aExtra"),
    time: gl.getUniformLocation(program, "uTime"),
    pointer: gl.getUniformLocation(program, "uPointer"),
    aspect: gl.getUniformLocation(program, "uAspect"),
    parallax: gl.getUniformLocation(program, "uParallax"),
    alpha: gl.getUniformLocation(program, "uAlpha"),
    pointSize: point ? gl.getUniformLocation(program, "uPointSize") : undefined,
    drift: point ? gl.getUniformLocation(program, "uDrift") : undefined,
  };
}

function createStaticBuffers(gl: WebGLRenderingContext, positions: Float32Array, colors: Float32Array, extra: Float32Array): BufferBundle {
  const position = gl.createBuffer();
  const color = gl.createBuffer();
  const extraBuffer = gl.createBuffer();
  if (!position || !color || !extraBuffer) throw new Error("WEBGL_BUFFER_UNAVAILABLE");

  gl.bindBuffer(gl.ARRAY_BUFFER, position);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, color);
  gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, extraBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, extra, gl.STATIC_DRAW);

  return { position, color, extra: extraBuffer, count: positions.length / 3 };
}

function bindBuffers(gl: WebGLRenderingContext, program: ProgramBundle, buffers: BufferBundle) {
  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
  gl.enableVertexAttribArray(program.position);
  gl.vertexAttribPointer(program.position, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.color);
  gl.enableVertexAttribArray(program.color);
  gl.vertexAttribPointer(program.color, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.extra);
  gl.enableVertexAttribArray(program.extra);
  gl.vertexAttribPointer(program.extra, 1, gl.FLOAT, false, 0, 0);
}

function setSharedUniforms(gl: WebGLRenderingContext, program: ProgramBundle, timeMs: number, pointer: PointerState, aspect: number, parallax: number, alpha: number) {
  gl.uniform1f(program.time, timeMs);
  gl.uniform2f(program.pointer, pointer.x, pointer.y);
  gl.uniform1f(program.aspect, aspect);
  gl.uniform1f(program.parallax, parallax);
  gl.uniform1f(program.alpha, alpha);
}

export function createAttackSurfaceScene(options: CreateAttackSurfaceSceneOptions): AttackSurfaceController {
  const { canvas, quality, onMilestone } = options;
  const profile = QUALITY_PROFILES[quality];
  const gl = canvas.getContext("webgl", {
    alpha: true,
    antialias: quality !== "mobile",
    depth: false,
    premultipliedAlpha: false,
    powerPreference: "high-performance",
  });
  if (!gl) throw new Error("WEBGL_UNAVAILABLE");
  onMilestone?.("capability");

  const geometry = createAttackSurfaceGeometry(profile);
  onMilestone?.("geometry");

  const geometryProgram = createProgram(gl, GEOMETRY_VERTEX, GEOMETRY_FRAGMENT);
  const pointProgram = createProgram(gl, POINT_VERTEX, POINT_FRAGMENT, true);
  const lineBuffers = createStaticBuffers(gl, geometry.linePositions, geometry.lineColors, geometry.lineMotion);
  const surfaceBuffers = createStaticBuffers(gl, geometry.surfacePositions, geometry.surfaceColors, geometry.surfaceMotion);
  const particleBuffers = createStaticBuffers(gl, geometry.particlePositions, geometry.particleColors, geometry.particleSeeds);

  const pulsePointCount = Math.max(1, profile.activePulses * 6);
  const pulsePositions = new Float32Array(pulsePointCount * 3);
  const pulseColors = new Float32Array(pulsePointCount * 3);
  const pulseSeeds = new Float32Array(pulsePointCount);
  const pulsePositionBuffer = gl.createBuffer();
  const pulseColorBuffer = gl.createBuffer();
  const pulseSeedBuffer = gl.createBuffer();
  if (!pulsePositionBuffer || !pulseColorBuffer || !pulseSeedBuffer) throw new Error("WEBGL_PULSE_BUFFER_UNAVAILABLE");
  gl.bindBuffer(gl.ARRAY_BUFFER, pulsePositionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, pulsePositions.byteLength, gl.DYNAMIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, pulseColorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, pulseColors.byteLength, gl.DYNAMIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, pulseSeedBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, pulseSeeds.byteLength, gl.DYNAMIC_DRAW);
  const pulseBuffers: BufferBundle = { position: pulsePositionBuffer, color: pulseColorBuffer, extra: pulseSeedBuffer, count: pulsePointCount };
  onMilestone?.("materials");

  gl.clearColor(0, 0, 0, 0);
  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);

  let targetPointer: PointerState = { x: 0, y: 0 };
  let currentPointer: PointerState = { x: 0, y: 0 };
  let visible = true;
  let disposed = false;
  let width = 1;
  let height = 1;
  let firstFrameDone = false;
  let resolveFirstFrame: (() => void) | null = null;
  const firstFrame = new Promise<void>((resolve) => { resolveFirstFrame = resolve; });

  const updatePulseBuffers = (timeMs: number) => {
    if (profile.activePulses <= 0) return 0;
    let cursor = 0;
    for (let pulse = 0; pulse < profile.activePulses; pulse += 1) {
      const pathIndex = pulse % geometry.pulsePaths.length;
      const path = geometry.pulsePaths[pathIndex];
      const pathLength = path.length / 3;
      const head = pulseSampleIndex(timeMs, pulse, pathLength, quality);
      const risk = pathIndex === 0 || pathIndex === 3;
      for (let trail = 0; trail < 6; trail += 1) {
        const sample = Math.max(0, head - trail * 2);
        const source = sample * 3;
        pulsePositions[cursor * 3] = path[source];
        pulsePositions[cursor * 3 + 1] = path[source + 1];
        pulsePositions[cursor * 3 + 2] = path[source + 2];
        const fade = 1 - trail / 7;
        pulseColors[cursor * 3] = (risk ? 1 : 0.25) * fade;
        pulseColors[cursor * 3 + 1] = (risk ? 0.42 : 0.95) * fade;
        pulseColors[cursor * 3 + 2] = (risk ? 0.12 : 0.78) * fade;
        pulseSeeds[cursor] = trail / 6;
        cursor += 1;
      }
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, pulsePositionBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, pulsePositions);
    gl.bindBuffer(gl.ARRAY_BUFFER, pulseColorBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, pulseColors);
    gl.bindBuffer(gl.ARRAY_BUFFER, pulseSeedBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, pulseSeeds);
    return cursor;
  };

  const render = (timeMs: number) => {
    if (disposed || !visible) return;
    currentPointer = smoothPointer(currentPointer, targetPointer, quality);
    const aspect = Math.max(0.7, width / Math.max(1, height));
    const parallax = getParallaxStrength(quality);

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (surfaceBuffers.count > 0) {
      gl.useProgram(geometryProgram.program);
      bindBuffers(gl, geometryProgram, surfaceBuffers);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      setSharedUniforms(gl, geometryProgram, timeMs, currentPointer, aspect, parallax, quality === "high" ? 0.14 : 0.09);
      gl.drawArrays(gl.TRIANGLES, 0, surfaceBuffers.count);
    }

    gl.useProgram(geometryProgram.program);
    bindBuffers(gl, geometryProgram, lineBuffers);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    setSharedUniforms(gl, geometryProgram, timeMs, currentPointer, aspect, parallax, 0.18);
    gl.drawArrays(gl.LINES, 0, lineBuffers.count);
    setSharedUniforms(gl, geometryProgram, timeMs, currentPointer, aspect, parallax, quality === "mobile" ? 0.62 : 0.78);
    gl.drawArrays(gl.LINES, 0, lineBuffers.count);

    gl.useProgram(pointProgram.program);
    bindBuffers(gl, pointProgram, particleBuffers);
    gl.uniform1f(pointProgram.pointSize ?? null, quality === "mobile" ? 4.2 : 5.3);
    gl.uniform1f(pointProgram.drift ?? null, quality === "reduced" ? 0 : 1);
    setSharedUniforms(gl, pointProgram, timeMs, currentPointer, aspect, parallax, quality === "mobile" ? 0.48 : 0.58);
    gl.drawArrays(gl.POINTS, 0, particleBuffers.count);

    const activePulsePoints = updatePulseBuffers(timeMs);
    if (activePulsePoints > 0) {
      bindBuffers(gl, pointProgram, pulseBuffers);
      gl.uniform1f(pointProgram.pointSize ?? null, quality === "mobile" ? 8.0 : 10.5);
      gl.uniform1f(pointProgram.drift ?? null, 0);
      setSharedUniforms(gl, pointProgram, timeMs, currentPointer, aspect, parallax, 0.9);
      gl.drawArrays(gl.POINTS, 0, activePulsePoints);
    }

    if (!firstFrameDone) {
      firstFrameDone = true;
      resolveFirstFrame?.();
      resolveFirstFrame = null;
    }
  };

  const resize = (nextWidth: number, nextHeight: number, dpr: number) => {
    if (disposed) return;
    width = Math.max(1, nextWidth);
    height = Math.max(1, nextHeight);
    const pixelRatio = Math.min(Math.max(1, dpr), profile.dprCap);
    const nextCanvasWidth = Math.max(1, Math.round(width * pixelRatio));
    const nextCanvasHeight = Math.max(1, Math.round(height * pixelRatio));
    if (canvas.width !== nextCanvasWidth || canvas.height !== nextCanvasHeight) {
      canvas.width = nextCanvasWidth;
      canvas.height = nextCanvasHeight;
    }
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    [lineBuffers, surfaceBuffers, particleBuffers, pulseBuffers].forEach((buffers) => {
      gl.deleteBuffer(buffers.position);
      gl.deleteBuffer(buffers.color);
      gl.deleteBuffer(buffers.extra);
    });
    gl.deleteProgram(geometryProgram.program);
    gl.deleteProgram(pointProgram.program);
  };

  // Keep a tiny deterministic read of the animation helper in this module so particle motion
  // policy remains part of the controller contract without allocating during render.
  void particleDrift(geometry.particleSeeds[0] ?? 0, 0, quality);

  return {
    render,
    resize,
    setPointer(x, y) {
      targetPointer = quality === "mobile" || quality === "reduced" ? { x: 0, y: 0 } : {
        x: Math.max(-1, Math.min(1, x)),
        y: Math.max(-1, Math.min(1, y)),
      };
    },
    setVisible(nextVisible) {
      visible = nextVisible;
    },
    dispose,
    firstFrame,
  };
}
