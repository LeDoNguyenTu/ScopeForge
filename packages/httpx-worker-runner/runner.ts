import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import type { ProviderExecutionContext } from "../capability-registry/types";
import type { HttpxProviderRequest, HttpxRawResult } from "../provider-httpx";
import { buildHttpxExecutionPlan } from "../provider-httpx/execution-plan";

const HTTPX_BINARY = "/opt/scopeforge/bin/httpx";
const MAX_OUTPUT_BYTES = 32_768;
const MAX_TECHNOLOGIES = 32;

export interface HttpxCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface HttpxCommandDriver {
  exec(
    file: string,
    args: readonly string[],
    options: Readonly<{
      timeoutMs: number;
      maxOutputBytes: number;
      signal: AbortSignal;
    }>,
  ): Promise<HttpxCommandResult>;
}

export interface ExecuteHttpxRunnerInput {
  request: Readonly<HttpxProviderRequest>;
  context: Readonly<ProviderExecutionContext>;
  trustedHostname: string;
}

function fixedEnvironment(): Record<string, string> {
  return {
    PATH: "/opt/scopeforge/bin:/usr/bin:/bin",
    HOME: "/tmp",
    TMPDIR: "/tmp",
    LANG: "C.UTF-8",
    LC_ALL: "C.UTF-8",
  };
}

function createDriver(): HttpxCommandDriver {
  return Object.freeze({
    exec(
      file: string,
      args: readonly string[],
      options: Readonly<{ timeoutMs: number; maxOutputBytes: number; signal: AbortSignal }>,
    ) {
      return new Promise<HttpxCommandResult>((resolve, reject) => {
        execFile(file, [...args], {
          encoding: "utf8",
          timeout: options.timeoutMs,
          maxBuffer: options.maxOutputBytes,
          windowsHide: true,
          cwd: "/tmp",
          env: fixedEnvironment(),
          signal: options.signal,
        }, (error, stdout, stderr) => {
          if (error && typeof error.code !== "number") {
            reject(new Error("HTTPX_PROCESS_EXECUTION_FAILED"));
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
    throw new Error("HTTPX_OUTPUT_OBJECT_REQUIRED");
  }
  return value as Record<string, unknown>;
}

function optionalText(value: unknown, max = 160): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new Error("HTTPX_OUTPUT_TEXT_INVALID");
  const normalized = value.trim();
  if (!normalized || normalized.length > max || /[\r\n\0]/.test(normalized)) {
    throw new Error("HTTPX_OUTPUT_TEXT_INVALID");
  }
  return normalized;
}

function technologies(value: unknown): readonly string[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || value.length > MAX_TECHNOLOGIES) {
    throw new Error("HTTPX_OUTPUT_TECHNOLOGY_INVALID");
  }
  const normalized = value.map((item) => optionalText(item, 80));
  if (normalized.some((item) => item === undefined)) throw new Error("HTTPX_OUTPUT_TECHNOLOGY_INVALID");
  const compact = [...new Set(normalized as string[])].sort();
  if (compact.length !== value.length) throw new Error("HTTPX_OUTPUT_TECHNOLOGY_INVALID");
  return Object.freeze(compact);
}

function tlsProtocol(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  const candidate = record(value);
  for (const key of ["version", "tls_version", "protocol"]) {
    const parsed = optionalText(candidate[key], 40);
    if (parsed) return parsed;
  }
  return undefined;
}

function parseOneJsonLine(stdout: string): { parsed: Record<string, unknown>; digest: string } | null {
  if (Buffer.byteLength(stdout, "utf8") > MAX_OUTPUT_BYTES) throw new Error("HTTPX_OUTPUT_LIMIT_EXCEEDED");
  const lines = stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return null;
  if (lines.length !== 1) throw new Error("HTTPX_OUTPUT_CARDINALITY_INVALID");

  let parsed: unknown;
  try {
    parsed = JSON.parse(lines[0]);
  } catch {
    throw new Error("HTTPX_OUTPUT_JSON_INVALID");
  }

  return {
    parsed: record(parsed),
    digest: createHash("sha256").update(lines[0], "utf8").digest("hex"),
  };
}

function parseStatus(value: unknown): number {
  if (!Number.isInteger(value) || (value as number) < 100 || (value as number) > 599) {
    throw new Error("HTTPX_OUTPUT_STATUS_INVALID");
  }
  return value as number;
}

export async function executeHttpxRunner(
  input: ExecuteHttpxRunnerInput,
  signal: AbortSignal,
  dependencies: { driver?: HttpxCommandDriver } = {},
): Promise<HttpxRawResult> {
  if (!input.context.targetNodeIds.includes(input.request.targetNodeId)) {
    throw new Error("HTTPX_TARGET_BINDING_INVALID");
  }
  if (input.context.maxRequests < 1 || input.context.maxRuntimeMs < 1) {
    throw new Error("HTTPX_EXECUTION_BUDGET_INVALID");
  }

  const plan = buildHttpxExecutionPlan(input.request, input.trustedHostname);
  const timeoutMs = Math.min(8_000, input.context.maxRuntimeMs);
  const result = await (dependencies.driver ?? createDriver()).exec(
    HTTPX_BINARY,
    plan.args,
    { timeoutMs, maxOutputBytes: MAX_OUTPUT_BYTES, signal },
  );

  if (result.exitCode !== 0) throw new Error("HTTPX_PROCESS_EXIT_NONZERO");
  if (Buffer.byteLength(result.stderr, "utf8") > MAX_OUTPUT_BYTES) {
    throw new Error("HTTPX_STDERR_LIMIT_EXCEEDED");
  }

  const line = parseOneJsonLine(result.stdout);
  const base = {
    capabilityId: "web.http.probe.v1" as const,
    actionId: input.context.actionId,
    targetNodeId: input.request.targetNodeId,
    scheme: input.request.scheme,
    port: input.request.port,
    maxRedirects: input.request.maxRedirects,
  };

  if (!line) return Object.freeze(base);

  const status = parseStatus(line.parsed.status_code);
  const chain = line.parsed.chain_status_codes;
  const redirectCount = Array.isArray(chain) ? Math.max(0, chain.length - 1) : 0;
  if (redirectCount !== 0) throw new Error("HTTPX_OUTPUT_REDIRECT_NOT_ALLOWED");

  return Object.freeze({
    ...base,
    record: Object.freeze({
      targetNodeId: input.request.targetNodeId,
      status,
      redirectCount,
      contentType: optionalText(line.parsed.content_type),
      title: optionalText(line.parsed.title),
      server: optionalText(line.parsed.webserver),
      tlsProtocol: tlsProtocol(line.parsed.tls),
      technologies: technologies(line.parsed.tech),
      evidenceRef: `phase12-httpx-json:${line.digest}`,
      observedAt: new Date().toISOString(),
    }),
  });
}
