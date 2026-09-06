import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  MATRIX_PROFILES,
  runBenchmarkMatrix,
} from "../../benchmarks/scanner-matrix.mjs";

function resultFor(id: string) {
  return {
    fixture: id,
    runs: [
      { run: 1, wallMs: 1, scanDurationMs: 1, rssDeltaBytes: 0 },
      { run: 2, wallMs: 1, scanDurationMs: 1, rssDeltaBytes: 0 },
      { run: 3, wallMs: 1, scanDurationMs: 1, rssDeltaBytes: 0 },
    ],
    maxWallMs: 100,
    summary: {
      minWallMs: 1,
      medianWallMs: 1,
      maxWallMs: 1,
      medianScanDurationMs: 1,
      maxRssDeltaBytes: 0,
    },
  };
}

describe("Phase 8B benchmark matrix", () => {
  it("exports the three production profiles in deterministic raw-text ID order", () => {
    expect(MATRIX_PROFILES.map((profile) => profile.id)).toEqual([
      "dependency-lockfile-heavy-v1",
      "iac-heavy-v1",
      "source-ast-heavy-v1",
    ]);
  });

  it("returns schema v1 with exactly three runs per profile and stable result ordering", async () => {
    const seen: string[] = [];
    const profiles = [
      { id: "z-profile" },
      { id: "a-profile" },
      { id: "m-profile" },
    ];

    const result = await runBenchmarkMatrix(profiles, {
      runProfile: async (profile: { id: string }) => {
        seen.push(profile.id);
        return resultFor(profile.id);
      },
    });

    expect(seen).toEqual(["a-profile", "m-profile", "z-profile"]);
    expect(result).toEqual({
      schemaVersion: 1,
      runsPerProfile: 3,
      profiles: [resultFor("a-profile"), resultFor("m-profile"), resultFor("z-profile")],
    });
  });

  it("rejects duplicate profile IDs before any profile starts", async () => {
    let runCount = 0;
    await expect(
      runBenchmarkMatrix([{ id: "duplicate" }, { id: "duplicate" }], {
        runProfile: async () => {
          runCount += 1;
          return resultFor("duplicate");
        },
      }),
    ).rejects.toThrow("duplicate benchmark profile id");
    expect(runCount).toBe(0);
  });

  it("exposes the permanent package script without changing the historical benchmark command", async () => {
    const packageJson = JSON.parse(await readFile(join(process.cwd(), "package.json"), "utf8"));
    expect(packageJson.scripts["benchmark:scanner"]).toBe("node benchmarks/scanner-medium.mjs");
    expect(packageJson.scripts["benchmark:matrix"]).toBe("node benchmarks/scanner-matrix.mjs");
  });
});
