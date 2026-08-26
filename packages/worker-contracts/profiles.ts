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

const REPOSITORY_SNAPSHOT_GITHUB_PUBLIC_V1: WorkerExecutionProfile = Object.freeze({
  executionClass: "repository_snapshot_github_public_v1",
  networkPolicy: "github_public_archive_and_attempt_artifact_put_v1",
  budget: Object.freeze({
    maxWallTimeMs: 300_000,
    maxCpuTimeMs: 120_000,
    maxMemoryBytes: 536_870_912,
    maxProcesses: 1,
    maxInputFiles: 20_000,
    maxInputBytes: 268_435_456,
    maxScratchBytes: 536_870_912,
    maxOutputBytes: 65_536,
  }),
});

export function workerExecutionProfile(
  executionClass: WorkerExecutionClass,
): WorkerExecutionProfile {
  switch (executionClass) {
    case "foundation_no_egress_v1":
      return FOUNDATION_NO_EGRESS_V1;
    case "repository_snapshot_github_public_v1":
      return REPOSITORY_SNAPSHOT_GITHUB_PUBLIC_V1;
  }

  const unreachable: never = executionClass;
  throw new Error(`Unsupported worker execution class: ${String(unreachable)}`);
}
