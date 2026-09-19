import { createHash } from "node:crypto";
import { createHttpDiscoveryProvider, type HttpDiscoveryRawResult } from "@/packages/provider-http-discovery";
import { validatePhase11HttpDiscoveryTerminalEnvelope } from "@/packages/worker-contracts";
import type { Phase11HttpWorkerLeaseIdentity } from "./preparation-context";
import type {
  Phase11HttpWorkerFinalizationContext,
  Phase11HttpWorkerFinalizationRepository,
  Phase11HttpWorkerFinalizationResult,
} from "./finalization-context";

export interface FinalizeLeasedPhase11HttpWorkerInput extends Phase11HttpWorkerLeaseIdentity {
  terminal: unknown;
}

export interface FinalizeLeasedPhase11HttpWorkerDependencies {
  getContext: Phase11HttpWorkerFinalizationRepository["getContext"];
  finalize: Phase11HttpWorkerFinalizationRepository["finalize"];
  advanceRun(input: {
    workspaceId: string;
    runId: string;
    authorizationSnapshotRef: string;
  }): Promise<unknown>;
  now?: () => Date;
}

function runIdentity(context: Phase11HttpWorkerFinalizationContext) {
  return Object.freeze({
    workspaceId: context.workspaceId,
    runId: context.runId,
    authorizationSnapshotRef: context.authorizationSnapshotRef,
  });
}

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

function fail(code: string): never {
  throw new Error(code);
}

function replay(
  context: Phase11HttpWorkerFinalizationContext,
  terminalDigest: string,
): Phase11HttpWorkerFinalizationResult | null {
  if (context.finishedAt === null) return null;
  if (context.priorOutcome === null || context.priorTerminalDigest !== terminalDigest) {
    fail("PHASE11_HTTP_WORKER_TERMINAL_CONFLICT");
  }
  return Object.freeze({ outcome: context.priorOutcome, replayed: true });
}

export async function finalizeLeasedPhase11HttpWorker(
  input: FinalizeLeasedPhase11HttpWorkerInput,
  dependencies: FinalizeLeasedPhase11HttpWorkerDependencies,
): Promise<Phase11HttpWorkerFinalizationResult> {
  const context = await dependencies.getContext({
    workerId: input.workerId,
    taskId: input.taskId,
    attemptId: input.attemptId,
    leaseToken: input.leaseToken,
  });
  let terminal;
  try {
    terminal = validatePhase11HttpDiscoveryTerminalEnvelope(input.terminal, {
      taskId: input.taskId,
      attemptId: input.attemptId,
    });
  } catch {
    fail("PHASE11_HTTP_WORKER_TERMINAL_INVALID");
  }
  const terminalDigest = digest(terminal);
  const replayed = replay(context, terminalDigest);
  if (replayed) {
    await dependencies.advanceRun(runIdentity(context));
    return replayed;
  }

  const now = (dependencies.now ?? (() => new Date()))();
  if (Date.parse(context.leaseExpiresAt) <= now.getTime()) {
    fail("PHASE11_HTTP_WORKER_AUTHORIZATION_FAILED");
  }
  const outcome = context.cancelRequested ? "cancelled" : terminal.outcome;
  const terminalRequestCount = terminal.result?.requestCount ?? null;
  let observations = [] as Awaited<ReturnType<ReturnType<typeof createHttpDiscoveryProvider>["normalize"]>>;
  let requestCount = terminalRequestCount ?? context.maxRequests;
  if (outcome === "succeeded") {
    if (!terminal.result) fail("PHASE11_HTTP_WORKER_TERMINAL_INVALID");
    if (new Set(terminal.result.records.map((record) => record.routeKind)).size !== terminal.result.records.length) {
      fail("PHASE11_HTTP_WORKER_TERMINAL_INVALID");
    }
    requestCount = terminal.result.requestCount;
    const raw: HttpDiscoveryRawResult = Object.freeze({
      capabilityId: context.capabilityId,
      actionId: context.actionId,
      targetNodeId: context.targetNodeId,
      discoveryProfile: context.discoveryProfile,
      records: Object.freeze(terminal.result.records.map((record) => Object.freeze({
        targetNodeId: context.targetNodeId,
        routeKind: record.routeKind,
        status: record.status,
        ...(record.contentType === undefined ? {} : { contentType: record.contentType }),
        evidenceRef: `phase11-http-attempt:${input.attemptId}:${record.routeKind}`,
        observedAt: now.toISOString(),
      }))),
    });
    const provider = createHttpDiscoveryProvider({
      run: async () => fail("PHASE11_HTTP_WORKER_EXECUTION_FORBIDDEN"),
    });
    observations = await provider.normalize(raw, {
      runId: context.runId,
      actionId: context.actionId,
      authorizationSnapshotRef: context.authorizationSnapshotRef,
    });
    if (new Set(observations.map((observation) => observation.observationId)).size !== observations.length) {
      fail("PHASE11_HTTP_WORKER_TERMINAL_INVALID");
    }
  }

  const result = await dependencies.finalize({
    workerId: input.workerId,
    taskId: input.taskId,
    attemptId: input.attemptId,
    leaseToken: input.leaseToken,
    workspaceId: context.workspaceId,
    runId: context.runId,
    actionId: context.actionId,
    authorizationId: context.authorizationId,
    authorizationSnapshotRef: context.authorizationSnapshotRef,
    terminalDigest,
    outcome,
    failureCode: outcome === "failed" ? terminal.failureCode : null,
    requestCount,
    metrics: terminal.metrics,
    observations,
  });
  await dependencies.advanceRun(runIdentity(context));
  return result;
}
