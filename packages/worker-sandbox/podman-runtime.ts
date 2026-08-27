import { execFile } from "node:child_process";
import path from "node:path";
import { buildPodmanCreateCommand } from "./podman-command";
import type {
  PodmanCommandDriver,
  PodmanCommandOptions,
  PodmanCommandResult,
  PodmanSandbox,
  PodmanSandboxExecutionInput,
} from "./types";

const CONTROL_TIMEOUT_MS = 30_000;
const EXECUTION_TIMEOUT_MS = 330_000;
const CONTROL_OUTPUT_BYTES = 64 * 1024;
const SCANNER_OUTPUT_BYTES = 3_670_016;

export class PodmanSandboxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PodmanSandboxError";
  }
}

function fixedPodmanEnvironment(): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {
    PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
    LANG: "C.UTF-8",
    LC_ALL: "C.UTF-8",
    TMPDIR: "/tmp",
  };
  if (process.env.HOME) environment.HOME = process.env.HOME;
  if (process.env.XDG_RUNTIME_DIR) environment.XDG_RUNTIME_DIR = process.env.XDG_RUNTIME_DIR;
  return environment;
}

export function createExecFilePodmanDriver(): PodmanCommandDriver {
  return Object.freeze({
    exec(
      file: string,
      args: readonly string[],
      options: PodmanCommandOptions = {},
    ): Promise<PodmanCommandResult> {
      return new Promise((resolve, reject) => {
        execFile(file, [...args], {
          encoding: "utf8",
          timeout: options.timeoutMs ?? CONTROL_TIMEOUT_MS,
          maxBuffer: options.maxOutputBytes ?? CONTROL_OUTPUT_BYTES,
          windowsHide: true,
          env: fixedPodmanEnvironment(),
        }, (error, stdout, stderr) => {
          if (error && typeof error.code !== "number") {
            reject(new PodmanSandboxError("Podman control command could not be executed within its fixed boundary."));
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

function requireSuccess(result: PodmanCommandResult, operation: string): void {
  if (result.exitCode !== 0) {
    throw new PodmanSandboxError(`Podman ${operation} failed inside the fixed scanner sandbox boundary.`);
  }
}

function parseContainerExit(result: PodmanCommandResult): number {
  requireSuccess(result, "wait");
  const text = result.stdout.trim();
  if (!/^[0-9]{1,3}$/.test(text)) {
    throw new PodmanSandboxError("Podman wait returned an invalid scanner container exit status.");
  }
  const exitCode = Number(text);
  if (!Number.isInteger(exitCode) || exitCode < 0 || exitCode > 255) {
    throw new PodmanSandboxError("Podman wait returned an invalid scanner container exit status.");
  }
  return exitCode;
}

function abortError(): DOMException {
  return new DOMException("Hosted scanner sandbox execution was aborted.", "AbortError");
}

function safeWorkDirectory(value: string): string {
  if (!path.isAbsolute(value) || /[,\r\n\u0000]/.test(value)) {
    throw new PodmanSandboxError("Sandbox work directory must be an injection-safe absolute path.");
  }
  return path.normalize(value);
}

export function createPodmanSandbox(
  dependencies: { driver?: PodmanCommandDriver } = {},
): PodmanSandbox {
  const driver = dependencies.driver ?? createExecFilePodmanDriver();

  return Object.freeze({
    async execute(
      input: PodmanSandboxExecutionInput,
      signal: AbortSignal,
    ) {
      if (signal.aborted) throw abortError();
      const command = buildPodmanCreateCommand(input);
      safeWorkDirectory(input.workDirectory);
      let containerMayExist = false;
      let removed = false;
      let forceRemoval: Promise<void> | null = null;
      let primaryError: unknown = null;

      const forceRemove = (): Promise<void> => {
        if (!containerMayExist || removed) return Promise.resolve();
        if (forceRemoval !== null) return forceRemoval;
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
        // Once the create command is dispatched, a control-channel error is not proof
        // that Podman failed before persisting the deterministic container name.
        // Treat the name as potentially live so finally always attempts idempotent cleanup.
        containerMayExist = true;
        const createdResult = await driver.exec(command.file, command.args, {
          timeoutMs: CONTROL_TIMEOUT_MS,
          maxOutputBytes: CONTROL_OUTPUT_BYTES,
        });
        requireSuccess(createdResult, "create");

        signal.addEventListener("abort", onAbort, { once: true });
        if (signal.aborted) {
          await forceRemove();
          throw abortError();
        }

        let attached: PodmanCommandResult;
        try {
          attached = await driver.exec(command.file, [
            "start",
            "--attach",
            command.containerName,
          ], {
            timeoutMs: EXECUTION_TIMEOUT_MS,
            maxOutputBytes: SCANNER_OUTPUT_BYTES,
          });
        } catch (error) {
          await forceRemove();
          if (signal.aborted) throw abortError();
          throw error;
        }

        if (signal.aborted) {
          await forceRemove();
          throw abortError();
        }

        let waited: PodmanCommandResult;
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
          throw new PodmanSandboxError("Podman attached and saved scanner exit statuses disagree.");
        }
        if (savedExit !== 0) {
          throw new PodmanSandboxError("Hosted scanner container failed inside the fixed sandbox boundary.");
        }
        if (Buffer.byteLength(attached.stdout, "utf8") > SCANNER_OUTPUT_BYTES) {
          throw new PodmanSandboxError("Hosted scanner output exceeds the fixed result boundary.");
        }

        return Object.freeze({
          containerName: command.containerName,
          output: attached.stdout,
        });
      } catch (error) {
        primaryError = error;
        throw error;
      } finally {
        signal.removeEventListener("abort", onAbort);
        if (forceRemoval !== null) {
          try {
            await forceRemoval;
          } catch (terminationError) {
            if (primaryError === null || primaryError instanceof DOMException) {
              throw terminationError;
            }
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