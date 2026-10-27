// @vitest-environment node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("commits the Phase 12 coordinator and directly invoked helpers as executable", () => {
  const scripts = [
    "scripts/phase12-provider-containment-bundle.sh",
    "scripts/phase12-stage-provider-assets.sh",
    "scripts/phase12-stage-egress-sidecar.sh",
    "scripts/phase12-provider-host-preflight.sh",
    "scripts/phase12-provider-linux-containment.sh",
  ];
  const entries = execFileSync("git", ["ls-files", "--stage", "--", ...scripts], { encoding: "utf8" });
  for (const script of scripts) {
    const entry = entries.split("\n").find((line) => line.endsWith(`\t${script}`));
    expect(entry, `${script} must execute on a clean Linux checkout`).toMatch(/^100755 /);
  }
});

it("bounds the preflight DNS thread pool within the eight-task ceiling", () => {
  const script = readFileSync("scripts/phase12-provider-host-preflight.sh", "utf8");
  expect(script).toContain("--pids-limit=8");
  expect(script).toContain("--env=UV_THREADPOOL_SIZE=1");
});

it("reserves sidecar PID capacity for a fixed readiness exec without raising the ceiling", () => {
  const containerfile = readFileSync("deploy/worker/Containerfile.provider-egress-sidecar", "utf8");
  expect(containerfile).toContain('"--v8-pool-size=1"');
  expect(readFileSync("scripts/phase12-provider-linux-containment.sh", "utf8")).toContain("--pids-limit=8");
});
