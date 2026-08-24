import { describe, expect, it } from "vitest";

import { createVulnerabilityFinding } from "@/packages/scanner-sca/findings/create-vulnerability-finding";
import type { NpmDependencyComponent } from "@/packages/scanner-sca/types";
import type { OsvVulnerabilityRecord } from "@/packages/scanner-sca/osv/types";

function component(sourceLine: number): NpmDependencyComponent {
  return {
    ecosystem: "npm",
    name: "lodash",
    version: "4.17.20",
    purl: "pkg:npm/lodash@4.17.20",
    sourceFile: "package-lock.json",
    sourceKind: "lockfile",
    certainty: "resolved",
    direct: true,
    dependencyGroup: "runtime",
    sourceLine,
    queryable: true
  };
}

describe("createVulnerabilityFinding", () => {
  it("keeps fingerprints stable across line movement for the same package and OSV identity", () => {
    const record: OsvVulnerabilityRecord = { id: "GHSA-stable" };

    const first = createVulnerabilityFinding(component(2), record);
    const moved = createVulnerabilityFinding(component(200), record);

    expect(first.fingerprint).toBe(moved.fingerprint);
    expect(first.location.startLine).toBe(2);
    expect(moved.location.startLine).toBe(200);
  });

  it("does not invent severity when OSV provides no recognized upstream severity", () => {
    const finding = createVulnerabilityFinding(component(1), {
      id: "OSV-UNKNOWN",
      aliases: ["CVE-2026-2222", "GHSA-alias"],
      summary: "A vulnerability with no severity metadata"
    });

    expect(finding.severity).toBe("info");
    expect(finding.metadata).toMatchObject({
      aliases: ["CVE-2026-2222", "GHSA-alias"],
      fixedVersions: []
    });
    expect(finding.metadata).not.toHaveProperty("upstreamSeverity");
  });
});
