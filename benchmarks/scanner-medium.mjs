import { mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";

import { buildMediumScannerFixture, MEDIUM_FIXTURE } from "./scanner-medium-fixture.mjs";

const require = createRequire(import.meta.url);
const { runCli } = require("../.scopeforge-build/packages/cli/run-cli.js");

const MAX_WALL_MS = 20_000;

function captureIo() {
  let stdout = "";
  let stderr = "";

  return {
    io: {
      stdout: (value) => {
        stdout += value;
      },
      stderr: (value) => {
        stderr += value;
      }
    },
    stdout: () => stdout,
    stderr: () => stderr
  };
}

function parseScanOutput(stdout) {
  try {
    return JSON.parse(stdout);
  } catch {
    throw new Error("benchmark scan did not emit valid JSON");
  }
}

function validateMeasurement({ parsed, wallMs, stderr }) {
  const filesAnalyzed = parsed?.inventory?.filesAnalyzed;
  const findings = Array.isArray(parsed?.findings) ? parsed.findings.length : -1;
  const errors = Array.isArray(parsed?.errors) ? parsed.errors.length : -1;
  const scanDurationMs = parsed?.scan?.durationMs;

  if (filesAnalyzed !== MEDIUM_FIXTURE.expectedFiles) {
    throw new Error(
      `expected ${MEDIUM_FIXTURE.expectedFiles} analyzed files, received ${String(filesAnalyzed)}`
    );
  }
  if (findings !== 0 || errors !== 0) {
    throw new Error(`benchmark fixture must stay clean, received ${findings} findings and ${errors} errors`);
  }
  if (!Number.isFinite(scanDurationMs) || scanDurationMs < 0) {
    throw new Error("benchmark scan metadata contains an invalid duration");
  }
  if (stderr.trim()) {
    throw new Error(`benchmark scan emitted stderr: ${stderr.trim()}`);
  }
  if (wallMs > MAX_WALL_MS) {
    throw new Error(`benchmark exceeded catastrophic regression ceiling: ${wallMs}ms > ${MAX_WALL_MS}ms`);
  }

  return { filesAnalyzed, findings, errors, scanDurationMs };
}

async function measureScan(root) {
  const capture = captureIo();
  const rssBefore = process.memoryUsage().rss;
  const started = performance.now();
  const exitCode = await runCli(["scan", root, "--format", "json"], { io: capture.io });
  const wallMs = Math.round(performance.now() - started);
  const rssAfter = process.memoryUsage().rss;

  if (exitCode !== 0) {
    throw new Error(`benchmark scan exited ${exitCode}: ${capture.stderr().trim() || "no diagnostic"}`);
  }

  const parsed = parseScanOutput(capture.stdout());
  const validated = validateMeasurement({ parsed, wallMs, stderr: capture.stderr() });

  return {
    fixture: MEDIUM_FIXTURE.name,
    ...validated,
    wallMs,
    rssDeltaBytes: Math.max(0, rssAfter - rssBefore),
    maxWallMs: MAX_WALL_MS
  };
}

async function main() {
  const root = await mkdtemp(join(tmpdir(), "scopeforge-benchmark-"));
  try {
    await buildMediumScannerFixture(root);
    const measurement = await measureScan(root);
    process.stdout.write(`SCOPEFORGE_BENCHMARK ${JSON.stringify(measurement)}\n`);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
