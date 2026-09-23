import { execFile } from "node:child_process";
import { buildExternalProviderSandboxPlan } from "./podman-command";
import type {
  ExternalProviderSandbox,
  ExternalProviderSandboxInput,
} from "./types";

const CONTROL_TIMEOUT_MS = 30_000;
const CONTROL_OUTPUT_BYTES = 65_536;
const SIDECAR_READY_ATTEMPTS = 20;
const SIDECAR_READY_DELAY_MS = 50;
const SIDECAR_READY_PROBE = [
  "const net=require('node:net');",
  "const s=net.connect({host:'127.0.0.1',port:17777});",
  "s.setTimeout(250);",
  "s.once('connect',()=>{s.destroy();process.exit(0)});",
  "s.once('timeout',()=>{s.destroy();process.exit(2)});",
  "s.once('error',()=>process.exit(3));",
].join("");

interface CommandResult {
  exitCode: number;
  stdout: string;
}

export interface ExternalProviderSandboxCommandDriver {
  exec(
    file: string,
    args: readonly string[],
    options: { timeoutMs: number; maxOutputBytes: number },
  ): Promise<CommandResult>;
}

export class ExternalProviderSandboxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExternalProviderSandboxError";
  }
}

function fixedEnvironment(): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {
    PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
    LANG: "C.UTF-8",
    LC_ALL: "C.UTF-8",
    TMPDIR: "/tmp",
    NODE_ENV: process.env.NODE_ENV ?? "production",
  };
  if (process.env.HOME) environment.HOME = process.env.HOME;
  if (process.env.XDG_RUNTIME_DIR) environment.XDG_RUNTIME_DIR = process.env.XDG_RUNTIME_DIR;
  return environment;
}

function createDriver(): ExternalProviderSandboxCommandDriver {
  return Object.freeze({
    exec(file, args, options) {
      return new Promise<CommandResult>((resolve, reject) => {
        execFile(file, [...args], {
          encoding: "utf8",
          timeout: options.timeoutMs,
          maxBuffer: options.maxOutputBytes,
          windowsHide: true,
          env: fixedEnvironment(),
        }, (error, stdout) => {
          if (error && typeof error.code !== "number") {
            reject(new ExternalProviderSandboxError("Podman command failed inside the fixed Phase 12 provider boundary."));
            return;
          }
          resolve({
            exitCode: error && typeof error.code === "number" ? error.code : 0,
            stdout: String(stdout),
          });
        });
      });
    },
  });
}

function requireSuccess(result: CommandResult, operation: string): void {
  if (result.exitCode !== 0) {
    throw new ExternalProviderSandboxError(`Podman ${operation} failed inside the fixed Phase 12 provider boundary.`);
  }
}

function abortError(): DOMException {
  return new DOMException("External provider sandbox execution was aborted.", "AbortError");
}

function providerLimits(input: ExternalProviderSandboxInput): {
  timeoutMs: number;
  maxOutputBytes: number;
} {
  return {
    timeoutMs: input.maxRuntimeMs + 2_000,
    maxOutputBytes: input.provider === "httpx" ? 32_768 : 65_536,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseContainerExit(result: CommandResult): number {
  requireSuccess(result, "wait");
  const text = result.stdout.trim();
  if (!/^[0-9]{1,3}$/.test(text)) {
    throw new ExternalProviderSandboxError("Podman wait returned an invalid provider exit status.");
  }
  const value = Number(text);
  if (!Number.isInteger(value) || value < 0 || value > 255) {
    throw new ExternalProviderSandboxError("Podman wait returned an invalid provider exit status.");
  }
  return value;
}

export function createExternalProviderSandbox(
  dependencies: { driver?: ExternalProviderSandboxCommandDriver } = {},
): ExternalProviderSandbox {
  const driver = dependencies.driver ?? createDriver();

  return Object.freeze({
    async execute(input, signal) {
      if (signal.aborted) throw abortError();
      const plan = buildExternalProviderSandboxPlan(input);
      const limits = providerLimits(input);
      let sidecarMayExist = false;
      let providerMayExist = false;
      let primaryError: unknown = null;
      let cleanupPromise: Promise<void> | null = null;

      const remove = async (name: string): Promise<void> => {
        const result = await driver.exec(plan.sidecar.file, [
          "rm", "--time=0", "--force", "--ignore", name,
        ], {
          timeoutMs: CONTROL_TIMEOUT_MS,
          maxOutputBytes: CONTROL_OUTPUT_BYTES,
        });
        requireSuccess(result, "forced cleanup");
      };

      const cleanup = (): Promise<void> => {
        if (cleanupPromise) return cleanupPromise;
        cleanupPromise = (async () => {
          if (providerMayExist) await remove(plan.providerName);
          if (sidecarMayExist) await remove(plan.sidecarName);
        })();
        return cleanupPromise;
      };

      const onAbort = () => {
        void cleanup().catch(() => undefined);
      };

      try {
        sidecarMayExist = true;
        requireSuccess(await driver.exec(plan.sidecar.file, plan.sidecar.args, {
          timeoutMs: CONTROL_TIMEOUT_MS,
          maxOutputBytes: CONTROL_OUTPUT_BYTES,
        }), "sidecar create");

        requireSuccess(await driver.exec(plan.sidecar.file, ["start", plan.sidecarName], {
          timeoutMs: CONTROL_TIMEOUT_MS,
          maxOutputBytes: CONTROL_OUTPUT_BYTES,
        }), "sidecar start");

        signal.addEventListener("abort", onAbort, { once: true });
        if (signal.aborted) {
          await cleanup();
          throw abortError();
        }

        let ready = false;
        for (let attempt = 0; attempt < SIDECAR_READY_ATTEMPTS; attempt += 1) {
          if (signal.aborted) {
            await cleanup();
            throw abortError();
          }
          const probe = await driver.exec(plan.sidecar.file, [
            "exec",
            plan.sidecarName,
            "/usr/local/bin/node",
            "-e",
            SIDECAR_READY_PROBE,
          ], {
            timeoutMs: 1_000,
            maxOutputBytes: 4_096,
          });
          if (probe.exitCode === 0) {
            ready = true;
            break;
          }
          await delay(SIDECAR_READY_DELAY_MS);
        }
        if (!ready) {
          throw new ExternalProviderSandboxError("Provider egress sidecar did not become ready inside the fixed boundary.");
        }

        providerMayExist = true;
        requireSuccess(await driver.exec(plan.provider.file, plan.provider.args, {
          timeoutMs: CONTROL_TIMEOUT_MS,
          maxOutputBytes: CONTROL_OUTPUT_BYTES,
        }), "provider create");

        let attached: CommandResult;
        try {
          attached = await driver.exec(plan.provider.file, [
            "start", "--attach", plan.providerName,
          ], limits);
        } catch (error) {
          await cleanup();
          if (signal.aborted) throw abortError();
          throw error;
        }

        if (signal.aborted) {
          await cleanup();
          throw abortError();
        }

        const waited = await driver.exec(plan.provider.file, ["wait", plan.providerName], {
          timeoutMs: CONTROL_TIMEOUT_MS,
          maxOutputBytes: CONTROL_OUTPUT_BYTES,
        });
        const savedExit = parseContainerExit(waited);
        if (attached.exitCode !== savedExit) {
          throw new ExternalProviderSandboxError("Podman attached and saved provider exit statuses disagree.");
        }
        if (savedExit !== 0) {
          throw new ExternalProviderSandboxError("External provider container failed inside the fixed sandbox boundary.");
        }
        if (Buffer.byteLength(attached.stdout, "utf8") > limits.maxOutputBytes) {
          throw new ExternalProviderSandboxError("External provider output exceeds the fixed result boundary.");
        }

        return Object.freeze({ output: attached.stdout });
      } catch (error) {
        primaryError = error;
        throw error;
      } finally {
        signal.removeEventListener("abort", onAbort);
        try {
          await cleanup();
        } catch (cleanupError) {
          if (primaryError === null) throw cleanupError;
        }
      }
    },
  });
}
