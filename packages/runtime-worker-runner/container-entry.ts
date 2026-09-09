import { runRuntimeMediatorUnixRequest } from "@/packages/runtime-worker-mediator/unix-client";
import type { RuntimeMediatorExecutionClass } from "@/packages/runtime-worker-mediator/contracts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const NONCE_PATTERN = /^[a-f0-9]{64}$/;
const MEDIATOR_TIMEOUT_MS = 30_000;

function executionClass(value: string): RuntimeMediatorExecutionClass {
  if (value === "passive_runtime_observation_v1" || value === "active_cors_validation_v1") {
    return value;
  }
  throw new Error("Runtime execution class is invalid.");
}

function parseArgs(argv: readonly string[]) {
  if (argv.length !== 8
      || argv[0] !== "--task-id"
      || argv[2] !== "--attempt-id"
      || argv[4] !== "--execution-class"
      || argv[6] !== "--session-nonce") {
    throw new Error("Runtime worker arguments are invalid.");
  }
  const taskId = argv[1] ?? "";
  const attemptId = argv[3] ?? "";
  const selectedClass = argv[5] ?? "";
  const nonce = argv[7] ?? "";
  if (!UUID_PATTERN.test(taskId) || !UUID_PATTERN.test(attemptId) || !NONCE_PATTERN.test(nonce)) {
    throw new Error("Runtime worker identity is invalid.");
  }
  return Object.freeze({
    operation: "run" as const,
    session: Object.freeze({
      taskId,
      attemptId,
      executionClass: executionClass(selectedClass),
      nonce,
    }),
  });
}

async function main(): Promise<void> {
  const request = parseArgs(process.argv.slice(2));
  const response = await runRuntimeMediatorUnixRequest(request, MEDIATOR_TIMEOUT_MS);
  process.stdout.write(`${JSON.stringify(response)}\n`);
}

void main().catch(() => {
  process.exitCode = 1;
});
