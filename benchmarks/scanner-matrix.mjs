import { pathToFileURL } from "node:url";

import {
  RUNS_PER_PROFILE,
  runBenchmarkProfile,
} from "./matrix/harness.mjs";
import { DEPENDENCY_LOCKFILE_HEAVY_PROFILE } from "./matrix/dependency-lockfile-heavy-fixture.mjs";
import { IAC_HEAVY_PROFILE } from "./matrix/iac-heavy-fixture.mjs";
import { SOURCE_AST_HEAVY_PROFILE } from "./matrix/source-ast-heavy-fixture.mjs";

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

export const MATRIX_PROFILES = Object.freeze([
  DEPENDENCY_LOCKFILE_HEAVY_PROFILE,
  IAC_HEAVY_PROFILE,
  SOURCE_AST_HEAVY_PROFILE,
]);

export async function runBenchmarkMatrix(profiles = MATRIX_PROFILES, dependencies = {}) {
  const seen = new Set();
  for (const profile of profiles) {
    if (seen.has(profile.id)) {
      throw new Error(`duplicate benchmark profile id: ${profile.id}`);
    }
    seen.add(profile.id);
  }

  const ordered = [...profiles].sort((left, right) => compareText(left.id, right.id));
  const runProfile = dependencies.runProfile ?? runBenchmarkProfile;
  const results = [];
  for (const profile of ordered) {
    results.push(await runProfile(profile));
  }

  return {
    schemaVersion: 1,
    runsPerProfile: RUNS_PER_PROFILE,
    profiles: results,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runBenchmarkMatrix()
    .then((result) => process.stdout.write(`SCOPEFORGE_BENCHMARK_MATRIX ${JSON.stringify(result)}\n`))
    .catch((error) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    });
}
