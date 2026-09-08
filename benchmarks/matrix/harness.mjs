import { mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";

const require = createRequire(import.meta.url);

export const RUNS_PER_PROFILE = 3;

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function countFindingRules(findings) {
  const counts = new Map();
  for (const finding of findings) {
    if (!finding || typeof finding.ruleId !== "string") {
      throw new Error("benchmark finding lacks a ruleId");
    }
    counts.set(finding.ruleId, (counts.get(finding.ruleId) ?? 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => compareText(left, right)));
}

function normalizedExpectedRuleCounts(expected) {
  return Object.fromEntries(Object.entries(expected).sort(([left], [right]) => compareText(left, right)));
}

function sameRuleCounts(actual, expected) {
  return JSON.stringify(actual) === JSON.stringify(normalizedExpectedRuleCounts(expected));
}

export function validateTimedScan({ profile, parsed, stderr, wallMs, rssDeltaBytes }) {
  const filesAnalyzed = parsed?.inventory?.filesAnalyzed;
  const findings = Array.isArray(parsed?.findings) ? parsed.findings : null;
  const errors = Array.isArray(parsed?.errors) ? parsed.errors : null;
  const scanDurationMs = parsed?.scan?.durationMs;

  if (filesAnalyzed !== profile.expectedFiles) {
    throw new Error(`benchmark ${profile.id} analyzed-file contract changed`);
  }
  if (findings === null || errors === null) {
    throw new Error(`benchmark ${profile.id} output shape is invalid`);
  }
  if (errors.length !== 0) {
    throw new Error(`benchmark ${profile.id} emitted scanner errors`);
  }
  if (stderr.trim() !== "") {
    throw new Error(`benchmark ${profile.id} emitted stderr`);
  }

  const findingRuleCounts = countFindingRules(findings);
  if (!sameRuleCounts(findingRuleCounts, profile.expectedFindingRuleCounts)) {
    throw new Error(`benchmark ${profile.id} finding contract changed`);
  }
  if (!Number.isFinite(scanDurationMs) || scanDurationMs < 0) {
    throw new Error(`benchmark ${profile.id} scan duration is invalid`);
  }
  if (!Number.isFinite(wallMs) || wallMs < 0) {
    throw new Error(`benchmark ${profile.id} wall time is invalid`);
  }
  if (wallMs > profile.maxWallMs) {
    throw new Error(`benchmark ${profile.id} exceeded catastrophic wall ceiling`);
  }
  if (!Number.isFinite(rssDeltaBytes) || rssDeltaBytes < 0) {
    throw new Error(`benchmark ${profile.id} RSS delta is invalid`);
  }

  return {
    filesAnalyzed,
    findings: findings.length,
    errors: errors.length,
    findingRuleCounts,
    scanDurationMs,
    wallMs,
    rssDeltaBytes,
  };
}

export function summarizeRuns(runs) {
  if (!Array.isArray(runs) || runs.length !== RUNS_PER_PROFILE) {
    throw new Error(`benchmark summary requires exactly ${RUNS_PER_PROFILE} runs`);
  }

  const wallTimes = runs.map((run) => run.wallMs).sort((left, right) => left - right);
  const scanDurations = runs.map((run) => run.scanDurationMs).sort((left, right) => left - right);
  const rssDeltas = runs.map((run) => run.rssDeltaBytes).sort((left, right) => left - right);

  return {
    minWallMs: wallTimes[0],
    medianWallMs: wallTimes[1],
    maxWallMs: wallTimes[2],
    medianScanDurationMs: scanDurations[1],
    maxRssDeltaBytes: rssDeltas[2],
  };
}

function captureIo() {
  let stdout = "";
  let stderr = "";
  return {
    io: {
      stdout(value) {
        stdout += value;
      },
      stderr(value) {
        stderr += value;
      },
    },
    stdout() {
      return stdout;
    },
    stderr() {
      return stderr;
    },
  };
}

function parseJsonOutput(profile, stdout) {
  try {
    return JSON.parse(stdout);
  } catch {
    throw new Error(`benchmark ${profile.id} scan did not emit valid JSON`);
  }
}

function defaultRunCli() {
  return require("../../.scopeforge-build/packages/cli/run-cli.js").runCli;
}

async function defaultMakeTempRoot() {
  return mkdtemp(join(tmpdir(), "scopeforge-matrix-"));
}

async function defaultRemoveTempRoot(root) {
  await rm(root, { recursive: true, force: true });
}

export async function runBenchmarkProfile(profile, dependencies = {}) {
  const runCliImpl = dependencies.runCliImpl ?? defaultRunCli();
  const makeTempRoot = dependencies.makeTempRoot ?? defaultMakeTempRoot;
  const removeTempRoot = dependencies.removeTempRoot ?? defaultRemoveTempRoot;
  const root = await makeTempRoot();

  try {
    await profile.buildFixture(root);
    await profile.preflight(root);

    const runs = [];
    for (let index = 0; index < RUNS_PER_PROFILE; index += 1) {
      const capture = captureIo();
      const rssBefore = process.memoryUsage().rss;
      const started = performance.now();
      const exitCode = await runCliImpl(["scan", root, "--format", "json"], { io: capture.io });
      const wallMs = Math.round(performance.now() - started);
      const rssAfter = process.memoryUsage().rss;

      if (exitCode !== 0) {
        throw new Error(
          `benchmark ${profile.id} scan exited ${exitCode}: ${capture.stderr().trim() || "no diagnostic"}`,
        );
      }

      const parsed = parseJsonOutput(profile, capture.stdout());
      const measurement = validateTimedScan({
        profile,
        parsed,
        stderr: capture.stderr(),
        wallMs,
        rssDeltaBytes: Math.max(0, rssAfter - rssBefore),
      });
      runs.push({ run: index + 1, ...measurement });
    }

    return {
      fixture: profile.id,
      runs,
      maxWallMs: profile.maxWallMs,
      summary: summarizeRuns(runs),
    };
  } finally {
    await removeTempRoot(root);
  }
}
