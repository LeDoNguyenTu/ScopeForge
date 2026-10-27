// @vitest-environment node
import { execFileSync } from "node:child_process";
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
