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
const WAIT_TIMEOUT_MS = 330_000;
const CONTROL_OUTPUT_BYTES = 64 * 1024;

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
            reject(new PodmanSandboxError("Podman control command could not be executed."));
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
      const workDirectory = safeWorkDirectory(input.workDirectory);
      const resultPath = path.join(workDirectory, "result.json");
      let created = false;
      let started = false;
      let terminationPromise: Promise<PodmanCommandResult> | null = null;
      let primaryError: unknown = null;

      const terminate = () => {
        if (!started || terminationPromise !== null) return;
        terminationPromise = driver.exec(command.file, [
          "kill",
          "--signal=KILL",
          command.containerName,
        ], {
          timeoutMs: CONTROL_TIMEOUT_MS,
          maxOutputBytes: CONTROL_OUTPUT_BYTES,
        });
      };

      const onAbort = () => terminate();

      try {
        const createdResult = await driver.exec(command.file, command.args, {
          timeoutMs: CONTROL_TIMEOUT_MS,
          maxOutputBytes: CONTROL_OUTPUT_BYTES,
        });
        requireSuccess(createdResult, "create");
        created = true;

        if (signal.aborted) throw abortError();
        signal.addEventListener("abort", onAbort, { once: true });

        const startedResult = await driver.exec(command.file, ["start", command.containerName], {
          timeoutMs: CONTROL_TIMEOUT_MS,
          maxOutputBytes: CONTROL_OUTPUT_BYTES,
        });
        requireSuccess(startedResult, "start");
        started = true;
        if (signal.aborted) terminate();

        const waited = await driver.exec(command.file, ["wait", command.containerName], {
          timeoutMs: WAIT_TIMEOUT_MS,
          maxOutputBytes: CONTROL_OUTPUT_BYTES,
        });
        const containerExit = parseContainerExit(waited);
        if (terminationPromise !== null) {
          await terminationPromise.catch(() => undefined);
        }
        if (signal.aborted) throw abortError();
        if (containerExit !== 0) {
          throw new PodmanSandboxError("Hosted scanner container failed inside the fixed sandbox boundary.");
        }

        const copied = await driver.exec(command.file, [
          "cp",
          `${command.containerName}:/result/result.json`,
          resultPath,
        ], {
          timeoutMs: CONTROL_TIMEOUT_MS,
          maxOutputBytes: CONTROL_OUTPUT_BYTES,
        });
        requireSuccess(copied, "result copy");

        return Object.freeze({
          containerName: command.containerName,
          resultPath,
        });
      } catch (error) {
        primaryError = error;
        throw error;
      } finally {
        signal.removeEventListener("abort", onAbort);
        if (created) {
          try {
            const removed = await driver.exec(command.file, [
              "rm",
              "--force",
              command.containerName,
            ], {
              timeoutMs: CONTROL_TIMEOUT_MS,
              maxOutputBytes: CONTROL_OUTPUT_BYTES,
            });
            requireSuccess(removed, "cleanup");
          } catch (cleanupError) {
            if (primaryError === null) throw cleanupError;
          }
        }
      }
    },
  });
}