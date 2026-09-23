import { createHash } from "node:crypto";
import { execFile, type ExecFileException } from "node:child_process";
import type { ProviderExecutionContext } from "../capability-registry/types";
import type {
  NucleiRawResult,
  NucleiRunnerRequest,
  NucleiSeverity,
} from "../provider-nuclei";
import { buildNucleiExecutionPlan } from "../provider-nuclei/execution-plan";

const NUCLEI_BINARY = "/opt/scopeforge/bin/nuclei";
const MAX_OUTPUT_BYTES = 65_536;
const MAX_MATCHES = 32;
const SEVERITIES = new Set<NucleiSeverity>(["info", "low", "medium", "high", "critical"]);

export interface NucleiCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface NucleiCommandDriver {
  exec(
    file: string,
    args: readonly string[],
    options: Readonly<{
      timeoutMs: number;
      maxOutputBytes: number;
      signal: AbortSignal;
    }>,
  ): Promise<NucleiCommandResult>;
}

export interface ExecuteNucleiRunnerInput {
  request: Readonly<NucleiRunnerRequest>;
  context: Readonly<ProviderExecutionContext>;
  target: Readonly<{ hostname: string; scheme: "http" | "https"; port: number }>;
}

function fixedEnvironment(): NodeJS.ProcessEnv {
  return {
    PATH: "/opt/scopeforge/bin:/usr/bin:/bin",
    HOME: "/tmp",
    TMPDIR: "/tmp",
    LANG: "C.UTF-8",
    LC_ALL: "C.UTF-8",
    NODE_ENV: "production",
  };
}

function createDriver(): NucleiCommandDriver {
  return Object.freeze({
    exec(file, args, options) {
      return new Promise<NucleiCommandResult>((resolve, reject) => {
        execFile(file, [...args], {
          encoding: "utf8",
          timeout: options.timeoutMs,
          maxBuffer: options.maxOutputBytes,
          windowsHide: true,
          cwd: "/tmp",
          env: fixedEnvironment(),
          signal: options.signal,
        }, (error: ExecFileException | null, stdout: string, stderr: string) => {
          if (error && typeof error.code !== "number") {
            reject(new Error("NUCLEI_PROCESS_EXECUTION_FAILED"));
            return;
          }
          resolve({
            exitCode: error && typeof error.code === "number" ? error.code : 0,
            stdout: String(stdout),
            stderr: String(stderr),
          });
        });
      });
    },
  });
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("NUCLEI_OUTPUT_OBJECT_REQUIRED");
  }
  return value as Record<string, unknown>;
}

function requiredText(value: unknown, code: string, max = 192): string {
  if (typeof value !== "string") throw new Error(code);
  const normalized = value.trim();
  if (!normalized || normalized.length > max || /[\r\n\0]/.test(normalized)) throw new Error(code);
  return normalized;
}

function optionalText(value: unknown, max = 160): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new Error("NUCLEI_OUTPUT_TEXT_INVALID");
  const normalized = value.trim();
  if (!normalized || normalized.length > max || /[\r\n\0]/.test(normalized)) {
    throw new Error("NUCLEI_OUTPUT_TEXT_INVALID");
  }
  return normalized;
}

function expectedOrigin(input: ExecuteNucleiRunnerInput): string {
  return new URL(
    `${input.target.scheme}://${input.target.hostname.toLowerCase()}:${input.target.port}`,
  ).origin;
}

function validateMatchedAt(value: unknown, origin: string): void {
  const text = requiredText(value, "NUCLEI_OUTPUT_MATCHED_AT_INVALID", 2048);
  let parsed: URL;
  try {
    parsed = new URL(text);
  } catch {
    throw new Error("NUCLEI_OUTPUT_MATCHED_AT_INVALID");
  }
  if (parsed.username || parsed.password || parsed.origin !== origin) {
    throw new Error("NUCLEI_OUTPUT_TARGET_OUT_OF_SCOPE");
  }
}

function parseLines(stdout: string): readonly { value: Record<string, unknown>; digest: string }[] {
  if (Buffer.byteLength(stdout, "utf8") > MAX_OUTPUT_BYTES) throw new Error("NUCLEI_OUTPUT_LIMIT_EXCEEDED");
  const lines = stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length > MAX_MATCHES) throw new Error("NUCLEI_OUTPUT_MATCH_LIMIT_EXCEEDED");
  return Object.freeze(lines.map((line) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      throw new Error("NUCLEI_OUTPUT_JSON_INVALID");
    }
    return Object.freeze({
      value: record(parsed),
      digest: createHash("sha256").update(line, "utf8").digest("hex"),
    });
  }));
}

export async function executeNucleiRunner(
  input: ExecuteNucleiRunnerInput,
  signal: AbortSignal,
  dependencies: { driver?: NucleiCommandDriver } = {},
): Promise<NucleiRawResult> {
  if (!input.context.targetNodeIds.includes(input.request.targetNodeId)) {
    throw new Error("NUCLEI_TARGET_BINDING_INVALID");
  }
  if (input.context.maxRequests !== 1 || input.context.maxRuntimeMs < 1) {
    throw new Error("NUCLEI_EXECUTION_BUDGET_INVALID");
  }

  const plan = buildNucleiExecutionPlan(input.request, input.target);
  const timeoutMs = Math.min(10_000, input.context.maxRuntimeMs);
  const result = await (dependencies.driver ?? createDriver()).exec(
    NUCLEI_BINARY,
    plan.args,
    { timeoutMs, maxOutputBytes: MAX_OUTPUT_BYTES, signal },
  );

  if (result.exitCode !== 0) throw new Error("NUCLEI_PROCESS_EXIT_NONZERO");
  if (Buffer.byteLength(result.stderr, "utf8") > MAX_OUTPUT_BYTES) {
    throw new Error("NUCLEI_STDERR_LIMIT_EXCEEDED");
  }

  const origin = expectedOrigin(input);
  const approved = new Set(input.request.approvedTemplateIds);
  const matches = parseLines(result.stdout).map(({ value, digest }) => {
    const templateId = requiredText(value["template-id"], "NUCLEI_OUTPUT_TEMPLATE_ID_INVALID", 160);
    if (!approved.has(templateId)) throw new Error("NUCLEI_OUTPUT_TEMPLATE_NOT_APPROVED");

    const info = record(value.info);
    const severity = requiredText(info.severity, "NUCLEI_OUTPUT_SEVERITY_INVALID", 16) as NucleiSeverity;
    if (!SEVERITIES.has(severity)) throw new Error("NUCLEI_OUTPUT_SEVERITY_INVALID");
    validateMatchedAt(value["matched-at"], origin);

    const timestamp = requiredText(value.timestamp, "NUCLEI_OUTPUT_TIMESTAMP_INVALID", 64);
    if (!Number.isFinite(Date.parse(timestamp))) throw new Error("NUCLEI_OUTPUT_TIMESTAMP_INVALID");

    return Object.freeze({
      targetNodeId: input.request.targetNodeId,
      templateId,
      severity,
      matcherName: optionalText(value["matcher-name"]),
      evidenceRef: `phase12-nuclei-json:${digest}`,
      observedAt: new Date(timestamp).toISOString(),
    });
  });

  return Object.freeze({
    capabilityId: "web.template.validate.v1",
    actionId: input.context.actionId,
    targetNodeId: input.request.targetNodeId,
    templateProfile: input.request.templateProfile,
    minimumSeverity: input.request.minimumSeverity,
    matches: Object.freeze(matches),
  });
}
