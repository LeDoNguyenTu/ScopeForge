import { createHash } from "node:crypto";
import type { Database } from "@/lib/database.types";
import {
  assetRef,
  type EvidenceRecord,
  type SecurityFinding,
} from "@/packages/security-domain";
import {
  evaluateRuntimeRules,
  mapRuntimeRuleMatchToEvidence,
  mapRuntimeRuleMatchToSecurityFinding,
  type RuntimeObservation,
} from "@/packages/runtime-observer";
import {
  evaluateCorsPolicyRules,
  mapActiveRuntimeRuleMatchToEvidence,
  mapActiveRuntimeRuleMatchToSecurityFinding,
  type CorsPolicyObservation,
} from "@/packages/runtime-validator";
import type { WorkerTerminalEnvelope } from "@/packages/worker-contracts";
import { RuntimeWorkerError } from "./errors";
import { validateRuntimeWorkerTerminal } from "./result-validation";
import type { RuntimeWorkerExecutionClass } from "./types";

type ScanJobRow = Database["public"]["Tables"]["scan_jobs"]["Row"];

type RuntimeWorkerOutcome = "succeeded" | "failed" | "cancelled";
type RuntimeWorkerFinalizationResult = {
  outcome: RuntimeWorkerOutcome;
  replayed: boolean;
};

export interface RuntimeWorkerFinalizationContext {
  taskId: string;
  attemptId: string;
  executionClass: RuntimeWorkerExecutionClass;
  domainJobId: string;
  workspaceId: string;
  assetId: string;
  cancelRequested: boolean;
  leaseExpiresAt: string;
  finishedAt: string | null;
  priorOutcome: RuntimeWorkerOutcome | null;
  priorTerminalDigest: string | null;
}

export interface RuntimeWorkerPublicationIdentity {
  workerId: string;
  taskId: string;
  attemptId: string;
  leaseToken: string;
}

export interface RuntimeWorkerFinalizeInput extends RuntimeWorkerPublicationIdentity {
  executionClass: RuntimeWorkerExecutionClass;
  terminalDigest: string;
  outcome: RuntimeWorkerOutcome;
  failureCode: string | null;
  requestCount: number;
  redirectCount: number;
  findingCount: number;
  metrics: WorkerTerminalEnvelope["metrics"];
}

export interface PassivePublicationInput {
  job: ScanJobRow;
  observations: readonly RuntimeObservation[];
  findings: readonly SecurityFinding[];
  evidence: readonly EvidenceRecord[];
  maximumBytes: number;
  observedAt: Date;
}

export interface ActivePublicationInput {
  job: ScanJobRow;
  observation: CorsPolicyObservation;
  findings: readonly SecurityFinding[];
  evidence: readonly EvidenceRecord[];
  maximumBytes: number;
  observedAt: Date;
}

export interface AtomicPassivePublicationInput {
  publication: PassivePublicationInput;
  finalization: RuntimeWorkerFinalizeInput;
}

export interface AtomicActivePublicationInput {
  publication: ActivePublicationInput;
  finalization: RuntimeWorkerFinalizeInput;
}

export interface RuntimeWorkerPublicationDependencies {
  getContext(input: RuntimeWorkerPublicationIdentity): Promise<RuntimeWorkerFinalizationContext>;
  loadPassiveJob(jobId: string): Promise<ScanJobRow | null>;
  loadActiveJob(jobId: string): Promise<ScanJobRow | null>;
  publishPassiveSuccess(input: AtomicPassivePublicationInput): Promise<RuntimeWorkerFinalizationResult>;
  publishActiveSuccess(input: AtomicActivePublicationInput): Promise<RuntimeWorkerFinalizationResult>;
  finalize(input: RuntimeWorkerFinalizeInput): Promise<RuntimeWorkerFinalizationResult>;
  now?: () => Date;
}

export interface PublishRuntimeWorkerTerminalInput extends RuntimeWorkerPublicationIdentity {
  terminal: unknown;
}

function digestTerminal(terminal: WorkerTerminalEnvelope): string {
  return createHash("sha256").update(JSON.stringify(terminal), "utf8").digest("hex");
}

function fail(code: "RUNTIME_WORKER_TASK_INVALID" | "RUNTIME_WORKER_AUTHORIZATION_FAILED"): never {
  throw new RuntimeWorkerError(code);
}

function observationBudget(job: ScanJobRow): number {
  const budget = job.budget;
  if (typeof budget !== "object" || budget === null || Array.isArray(budget)) {
    fail("RUNTIME_WORKER_TASK_INVALID");
  }
  const maximum = (budget as Record<string, unknown>).maxObservationBytes;
  if (!Number.isInteger(maximum) || (maximum as number) <= 0) {
    fail("RUNTIME_WORKER_TASK_INVALID");
  }
  return maximum as number;
}

function terminalCounts(terminal: WorkerTerminalEnvelope): {
  requestCount: number;
  redirectCount: number;
} {
  if (terminal.outcome !== "succeeded" || !terminal.result) {
    return { requestCount: 0, redirectCount: 0 };
  }
  if (terminal.result.kind === "passive_runtime_observation") {
    return {
      requestCount: terminal.result.requestCount,
      redirectCount: terminal.result.redirectCount,
    };
  }
  if (terminal.result.kind === "active_cors_validation") {
    return { requestCount: terminal.result.requestCount, redirectCount: 0 };
  }
  return { requestCount: 0, redirectCount: 0 };
}

function replayResult(
  context: RuntimeWorkerFinalizationContext,
  digest: string,
): { outcome: RuntimeWorkerOutcome; replayed: true } | null {
  if (!context.finishedAt) return null;
  if (!context.priorOutcome
      || !context.priorTerminalDigest
      || context.priorTerminalDigest !== digest) {
    fail("RUNTIME_WORKER_TASK_INVALID");
  }
  return Object.freeze({ outcome: context.priorOutcome, replayed: true as const });
}

function finalizationInput(
  input: PublishRuntimeWorkerTerminalInput,
  context: RuntimeWorkerFinalizationContext,
  terminal: WorkerTerminalEnvelope,
  terminalDigest: string,
  outcome: RuntimeWorkerOutcome,
  failureCode: string | null,
  requestCount: number,
  redirectCount: number,
  findingCount: number,
): RuntimeWorkerFinalizeInput {
  return Object.freeze({
    workerId: input.workerId,
    taskId: input.taskId,
    attemptId: input.attemptId,
    leaseToken: input.leaseToken,
    executionClass: context.executionClass,
    terminalDigest,
    outcome,
    failureCode,
    requestCount,
    redirectCount,
    findingCount,
    metrics: terminal.metrics,
  });
}

async function finalizeCancellation(
  input: PublishRuntimeWorkerTerminalInput,
  context: RuntimeWorkerFinalizationContext,
  terminal: WorkerTerminalEnvelope,
  terminalDigest: string,
  dependencies: RuntimeWorkerPublicationDependencies,
) {
  return dependencies.finalize(finalizationInput(
    input,
    context,
    terminal,
    terminalDigest,
    "cancelled",
    null,
    0,
    0,
    0,
  ));
}

export async function publishRuntimeWorkerTerminal(
  input: PublishRuntimeWorkerTerminalInput,
  dependencies: RuntimeWorkerPublicationDependencies,
): Promise<RuntimeWorkerFinalizationResult> {
  const context = await dependencies.getContext({
    workerId: input.workerId,
    taskId: input.taskId,
    attemptId: input.attemptId,
    leaseToken: input.leaseToken,
  });
  if (context.taskId !== input.taskId || context.attemptId !== input.attemptId) {
    fail("RUNTIME_WORKER_TASK_INVALID");
  }

  const terminal = validateRuntimeWorkerTerminal(input.terminal, {
    taskId: input.taskId,
    attemptId: input.attemptId,
    executionClass: context.executionClass,
  });
  const terminalDigest = digestTerminal(terminal);
  const replay = replayResult(context, terminalDigest);
  if (replay) return replay;

  if (terminal.outcome === "cancelled") {
    return finalizeCancellation(input, context, terminal, terminalDigest, dependencies);
  }

  if (terminal.outcome === "failed") {
    return dependencies.finalize(finalizationInput(
      input,
      context,
      terminal,
      terminalDigest,
      "failed",
      terminal.failureCode,
      0,
      0,
      0,
    ));
  }

  if (context.cancelRequested) {
    return finalizeCancellation(input, context, terminal, terminalDigest, dependencies);
  }

  const observedAt = (dependencies.now ?? (() => new Date()))();
  const leaseExpiresAt = Date.parse(context.leaseExpiresAt);
  if (!Number.isFinite(leaseExpiresAt)) {
    fail("RUNTIME_WORKER_TASK_INVALID");
  }
  if (leaseExpiresAt <= observedAt.getTime()) {
    fail("RUNTIME_WORKER_AUTHORIZATION_FAILED");
  }

  const ref = assetRef(context.assetId);
  const counts = terminalCounts(terminal);

  if (context.executionClass === "passive_runtime_observation_v1") {
    if (terminal.result?.kind !== "passive_runtime_observation") {
      fail("RUNTIME_WORKER_TASK_INVALID");
    }
    const job = await dependencies.loadPassiveJob(context.domainJobId);
    if (!job) fail("RUNTIME_WORKER_TASK_INVALID");
    if (job.status !== "running") fail("RUNTIME_WORKER_TASK_INVALID");
    if (job.cancel_requested_at !== null) {
      return finalizeCancellation(input, context, terminal, terminalDigest, dependencies);
    }
    const matches = evaluateRuntimeRules({ observations: terminal.result.observations, now: observedAt });
    const evidence = matches.map((match) => mapRuntimeRuleMatchToEvidence({ assetRef: ref, match }));
    const findings = matches.map((match) => mapRuntimeRuleMatchToSecurityFinding({ assetRef: ref, match }));
    const finalization = finalizationInput(
      input,
      context,
      terminal,
      terminalDigest,
      "succeeded",
      null,
      counts.requestCount,
      counts.redirectCount,
      findings.length,
    );
    return dependencies.publishPassiveSuccess({
      publication: {
        job,
        observations: terminal.result.observations,
        findings,
        evidence,
        maximumBytes: observationBudget(job),
        observedAt,
      },
      finalization,
    });
  }

  if (terminal.result?.kind !== "active_cors_validation" || !terminal.result.observation) {
    fail("RUNTIME_WORKER_TASK_INVALID");
  }
  const job = await dependencies.loadActiveJob(context.domainJobId);
  if (!job) fail("RUNTIME_WORKER_TASK_INVALID");
  if (job.status !== "running") fail("RUNTIME_WORKER_TASK_INVALID");
  if (job.cancel_requested_at !== null) {
    return finalizeCancellation(input, context, terminal, terminalDigest, dependencies);
  }
  const matches = evaluateCorsPolicyRules({ observation: terminal.result.observation });
  const evidence = matches.map((match) => mapActiveRuntimeRuleMatchToEvidence({ assetRef: ref, match }));
  const findings = matches.map((match) => mapActiveRuntimeRuleMatchToSecurityFinding({ assetRef: ref, match }));
  const finalization = finalizationInput(
    input,
    context,
    terminal,
    terminalDigest,
    "succeeded",
    null,
    counts.requestCount,
    counts.redirectCount,
    findings.length,
  );
  return dependencies.publishActiveSuccess({
    publication: {
      job,
      observation: terminal.result.observation,
      findings,
      evidence,
      maximumBytes: observationBudget(job),
      observedAt,
    },
    finalization,
  });
}
