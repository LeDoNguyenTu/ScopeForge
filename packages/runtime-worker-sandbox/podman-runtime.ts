import { execFile } from "node:child_process";
import { buildRuntimeWorkerPodmanCreateCommand } from "./podman-command";
import type {
  RuntimeWorkerExecutionClass,
  RuntimeWorkerPodmanCommandInput,
  RuntimeWorkerSandbox,
} from "./types";

const CONTROL_TIMEOUT_MS = 30_000;
const CONTROL_OUTPUT_BYTES = 65_536;

export class RuntimeWorkerSandboxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuntimeWorkerSandboxError";
  }
}

interface CommandResult {
  exitCode: number;
  stdout: string;
}

interface CommandDriver {
  exec(
    file: string,
    args: readonly string[],
    options: { timeoutMs: number; maxOutputBytes: number },
  ): Promise<CommandResult>;
}

function runtimeLimits(executionClass: RuntimeWorkerExecutionClass): {
  timeoutMs: number;
  maxOutputBytes: number;
} {
  return executionClass === "passive_runtime_observation_v1"
    ? { timeoutMs: 30_000, maxOutputBytes: 131_072 }
    : { timeoutMs: 20_000, maxOutputBytes: 65_536 };
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

function createDriver(): CommandDriver {
  const driver: CommandDriver = {
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
            reject(new RuntimeWorkerSandboxError("Podman runtime command failed inside the fixed Phase 6D boundary."));
            return;
          }
          resolve({
            exitCode: error && typeof error.code === "number" ? error.code : 0,
            stdout: String(stdout),
          });
        });
      });
    },
  };
  return Object.freeze(driver);
}

function requireSuccess(result: CommandResult, operation: string): void {
  if (result.exitCode !== 0) {
    throw new RuntimeWorkerSandboxError(`Podman ${operation} failed inside the fixed Phase 6D boundary.`);
  }
}

function abortError(): DOMException {
  return new DOMException("Runtime worker sandbox execution was aborted.", "AbortError");
}

function parseContainerExit(result: CommandResult): number {
  requireSuccess(result, "wait");
  const text = result.stdout.trim();
  if (!/^[0-9]{1,3}$/.test(text)) {
    throw new RuntimeWorkerSandboxError("Podman wait returned an invalid runtime-worker exit status.");
  }
  const exitCode = Number(text);
  if (!Number.isInteger(exitCode) || exitCode < 0 || exitCode > 255) {
    throw new RuntimeWorkerSandboxError("Podman wait returned an invalid runtime-worker exit status.");
  }
  return exitCode;
}

export function createRuntimeWorkerSandbox(
  dependencies: { driver?: CommandDriver } = {},
): RuntimeWorkerSandbox {
  const driver = dependencies.driver ?? createDriver();

  return Object.freeze({
    async execute(input: RuntimeWorkerPodmanCommandInput, signal: AbortSignal) {
      if (signal.aborted) throw abortError();
      const command = buildRuntimeWorkerPodmanCreateCommand(input);
      const limits = runtimeLimits(input.executionClass);
      let containerMayExist = false;
      let removed = false;
      let forceRemoval: Promise<void> | null = null;
      let primaryError: unknown = null;

      const forceRemove = (): Promise<void> => {
        if (!containerMayExist || removed) return Promise.resolve();
        if (forceRemoval) return forceRemoval;
        forceRemoval = driver.exec(command.file, [
          "rm",
          "--time=0",
          "--force",
          command.containerName,
        ], {
          timeoutMs: CONTROL_TIMEOUT_MS,
          maxOutputBytes: CONTROL_OUTPUT_BYTES,
        }).then((result) => {
          requireSuccess(result, "forced termination");
          removed = true;
        });
        return forceRemoval;
      };

      const onAbort = () => {
        void forceRemove().catch(() => undefined);
      };

      try {
        containerMayExist = true;
        const created = await driver.exec(command.file, command.args, {
          timeoutMs: CONTROL_TIMEOUT_MS,
          maxOutputBytes: CONTROL_OUTPUT_BYTES,
        });
        requireSuccess(created, "create");

        signal.addEventListener("abort", onAbort, { once: true });
        if (signal.aborted) {
          await forceRemove();
          throw abortError();
        }

        let attached: CommandResult;
        try {
          attached = await driver.exec(command.file, ["start", "--attach", command.containerName], limits);
        } catch (error) {
          await forceRemove();
          if (signal.aborted) throw abortError();
          throw error;
        }

        if (signal.aborted) {
          await forceRemove();
          throw abortError();
        }

        let waited: CommandResult;
        try {
          waited = await driver.exec(command.file, ["wait", command.containerName], {
            timeoutMs: CONTROL_TIMEOUT_MS,
            maxOutputBytes: CONTROL_OUTPUT_BYTES,
          });
        } catch (error) {
          await forceRemove();
          throw error;
        }
        const savedExit = parseContainerExit(waited);
        if (attached.exitCode !== savedExit) {
          throw new RuntimeWorkerSandboxError("Podman attached and saved runtime-worker exit statuses disagree.");
        }
        if (savedExit !== 0) {
          throw new RuntimeWorkerSandboxError("Runtime worker container failed inside the fixed sandbox boundary.");
        }
        if (Buffer.byteLength(attached.stdout, "utf8") > limits.maxOutputBytes) {
          throw new RuntimeWorkerSandboxError("Runtime worker output exceeds the fixed result boundary.");
        }
        return Object.freeze({ output: attached.stdout });
      } catch (error) {
        primaryError = error;
        throw error;
      } finally {
        signal.removeEventListener("abort", onAbort);
        if (forceRemoval) {
          try {
            await forceRemoval;
          } catch (terminationError) {
            if (primaryError === null || primaryError instanceof DOMException) throw terminationError;
          }
        }
        if (containerMayExist && !removed) {
          try {
            const cleaned = await driver.exec(command.file, [
              "rm",
              "--force",
              "--ignore",
              command.containerName,
            ], {
              timeoutMs: CONTROL_TIMEOUT_MS,
              maxOutputBytes: CONTROL_OUTPUT_BYTES,
            });
            requireSuccess(cleaned, "cleanup");
            removed = true;
          } catch (cleanupError) {
            if (primaryError === null) throw cleanupError;
          }
        }
      }
    },
  });
}
