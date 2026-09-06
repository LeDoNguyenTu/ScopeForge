import { describe, expect, it } from "vitest";
import {
  countFindingRules,
  runBenchmarkProfile,
  summarizeRuns,
  validateTimedScan,
} from "../../benchmarks/matrix/harness.mjs";

const profile = {
  id: "example-v1",
  expectedFiles: 3,
  expectedFindingRuleCounts: { "jsts/dynamic-code-execution": 2 },
  maxWallMs: 1000,
};

function validParsed() {
  return {
    inventory: { filesAnalyzed: 3 },
    findings: [
      { ruleId: "jsts/dynamic-code-execution" },
      { ruleId: "jsts/dynamic-code-execution" },
    ],
    errors: [],
    scan: { durationMs: 12 },
  };
}

describe("Phase 8B benchmark harness", () => {
  it("counts finding rules deterministically", () => {
    expect(
      countFindingRules([
        { ruleId: "z/rule" },
        { ruleId: "a/rule" },
        { ruleId: "z/rule" },
      ]),
    ).toEqual({ "a/rule": 1, "z/rule": 2 });
  });

  it("accepts exact files/findings/errors and normalizes the measurement", () => {
    expect(
      validateTimedScan({
        profile,
        parsed: validParsed(),
        stderr: "",
        wallMs: 15,
        rssDeltaBytes: 1024,
      }),
    ).toEqual({
      filesAnalyzed: 3,
      findings: 2,
      errors: 0,
      findingRuleCounts: { "jsts/dynamic-code-execution": 2 },
      scanDurationMs: 12,
      wallMs: 15,
      rssDeltaBytes: 1024,
    });
  });

  it("rejects a missing expected finding", () => {
    const parsed = validParsed();
    parsed.findings.pop();
    expect(() => validateTimedScan({ profile, parsed, stderr: "", wallMs: 15, rssDeltaBytes: 1 })).toThrow(
      "finding contract changed",
    );
  });

  it("rejects an unexpected rule ID", () => {
    const parsed = validParsed();
    parsed.findings.push({ ruleId: "unexpected/rule" });
    expect(() => validateTimedScan({ profile, parsed, stderr: "", wallMs: 15, rssDeltaBytes: 1 })).toThrow(
      "finding contract changed",
    );
  });

  it("rejects scanner errors", () => {
    const parsed = validParsed();
    parsed.errors.push({ code: "broken" });
    expect(() => validateTimedScan({ profile, parsed, stderr: "", wallMs: 15, rssDeltaBytes: 1 })).toThrow(
      "emitted scanner errors",
    );
  });

  it("rejects stderr output", () => {
    expect(() =>
      validateTimedScan({ profile, parsed: validParsed(), stderr: "warning", wallMs: 15, rssDeltaBytes: 1 }),
    ).toThrow("emitted stderr");
  });

  it("rejects the wrong analyzed file count", () => {
    const parsed = validParsed();
    parsed.inventory.filesAnalyzed = 4;
    expect(() => validateTimedScan({ profile, parsed, stderr: "", wallMs: 15, rssDeltaBytes: 1 })).toThrow(
      "analyzed-file contract changed",
    );
  });

  it.each([[-1], [Number.NaN], [Number.POSITIVE_INFINITY]])("rejects invalid scan duration %s", (durationMs) => {
    const parsed = validParsed();
    parsed.scan.durationMs = durationMs;
    expect(() => validateTimedScan({ profile, parsed, stderr: "", wallMs: 15, rssDeltaBytes: 1 })).toThrow(
      "scan duration is invalid",
    );
  });

  it.each([[-1], [Number.NaN], [Number.POSITIVE_INFINITY]])("rejects invalid wall time %s", (wallMs) => {
    expect(() => validateTimedScan({ profile, parsed: validParsed(), stderr: "", wallMs, rssDeltaBytes: 1 })).toThrow(
      "wall time is invalid",
    );
  });

  it("rejects wall time above the catastrophic ceiling", () => {
    expect(() =>
      validateTimedScan({ profile, parsed: validParsed(), stderr: "", wallMs: 1001, rssDeltaBytes: 1 }),
    ).toThrow("exceeded catastrophic wall ceiling");
  });

  it.each([[-1], [Number.NaN], [Number.POSITIVE_INFINITY]])("rejects invalid RSS delta %s", (rssDeltaBytes) => {
    expect(() => validateTimedScan({ profile, parsed: validParsed(), stderr: "", wallMs: 15, rssDeltaBytes })).toThrow(
      "RSS delta is invalid",
    );
  });

  it("summarizes exactly three integer runs", () => {
    expect(
      summarizeRuns([
        { wallMs: 30, scanDurationMs: 20, rssDeltaBytes: 100 },
        { wallMs: 10, scanDurationMs: 8, rssDeltaBytes: 300 },
        { wallMs: 20, scanDurationMs: 15, rssDeltaBytes: 200 },
      ]),
    ).toEqual({
      minWallMs: 10,
      medianWallMs: 20,
      maxWallMs: 30,
      medianScanDurationMs: 15,
      maxRssDeltaBytes: 300,
    });
  });

  it("rejects a run count other than three", () => {
    expect(() => summarizeRuns([{ wallMs: 1, scanDurationMs: 1, rssDeltaBytes: 1 }])).toThrow(
      "exactly 3 runs",
    );
  });

  it("builds once, preflights once, runs exactly three scans, and always removes the fixture", async () => {
    const calls = { build: 0, preflight: 0, run: 0, remove: 0 };
    const executionProfile = {
      ...profile,
      async buildFixture(root: string) {
        expect(root).toBe("/tmp/phase8b-test");
        calls.build += 1;
      },
      async preflight(root: string) {
        expect(root).toBe("/tmp/phase8b-test");
        calls.preflight += 1;
      },
    };

    const result = await runBenchmarkProfile(executionProfile, {
      makeTempRoot: async () => "/tmp/phase8b-test",
      removeTempRoot: async (root: string) => {
        expect(root).toBe("/tmp/phase8b-test");
        calls.remove += 1;
      },
      runCliImpl: async (_argv: string[], options: { io: { stdout(value: string): void } }) => {
        calls.run += 1;
        options.io.stdout(`${JSON.stringify(validParsed())}\n`);
        return 0;
      },
    });

    expect(calls).toEqual({ build: 1, preflight: 1, run: 3, remove: 1 });
    expect(result.fixture).toBe("example-v1");
    expect(result.maxWallMs).toBe(1000);
    expect(result.runs.map((run: { run: number }) => run.run)).toEqual([1, 2, 3]);
    expect(result.runs.every((run: { findingRuleCounts: Record<string, number> }) => run.findingRuleCounts["jsts/dynamic-code-execution"] === 2)).toBe(true);
  });
});
