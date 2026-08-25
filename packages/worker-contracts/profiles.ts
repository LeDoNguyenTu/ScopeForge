import type {
  WorkerExecutionClass,
  WorkerExecutionProfile,
} from "./types";

const FOUNDATION_NO_EGRESS_V1: WorkerExecutionProfile = Object.freeze({
  executionClass: "foundation_no_egress_v1",
  networkPolicy: "none",
  budget: Object.freeze({
    maxWallTimeMs: 30_000,
    maxCpuTimeMs: 20_000,
    maxMemoryBytes: 268_435_456,
    maxProcesses: 4,
    maxInputFiles: 100,
    maxInputBytes: 10_485_760,
    maxScratchBytes: 33_554_432,
    maxOutputBytes: 1_048_576,
  }),
});

export function workerExecutionProfile(
  executionClass: WorkerExecutionClass,
): WorkerExecutionProfile {
  switch (executionClass) {
    case "foundation_no_egress_v1":
      return FOUNDATION_NO_EGRESS_V1;
  }

  const unreachable: never = executionClass;
  throw new Error(`Unsupported worker execution class: ${String(unreachable)}`);
}
