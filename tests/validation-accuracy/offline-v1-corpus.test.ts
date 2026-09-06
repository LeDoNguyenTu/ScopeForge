import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  evaluateValidationCorpus,
  loadValidationCorpus,
  type ValidationProvenance,
} from "@/packages/validation-accuracy";

const CORPUS_ROOT = join(process.cwd(), "validation", "corpus", "offline-v1");
const EXPECTED_RULE_IDS = [
  "iac/config-npm-strict-ssl-disabled",
  "iac/docker-floating-base-image",
  "iac/github-actions-write-all-permissions",
  "iac/kubernetes-privileged-container",
  "iac/terraform-aws-public-rds",
  "jsts/command-injection",
  "jsts/dynamic-code-execution",
  "secrets/github-token",
] as const;

const PROVENANCE: ValidationProvenance = Object.freeze({
  scopeforgeVersion: "0.1.0",
  commitSha: "0000000000000000000000000000000000000000",
  nodeVersion: process.version,
  platform: process.platform,
  arch: process.arch,
});

describe("scopeforge-offline-v1 corpus", () => {
  it("loads exactly 32 unique deterministic cases", async () => {
    const first = await loadValidationCorpus(CORPUS_ROOT);
    const second = await loadValidationCorpus(CORPUS_ROOT);

    expect(first.manifest.corpusId).toBe("scopeforge-offline-v1");
    expect(first.manifest.corpusVersion).toBe("1.0.0");
    expect(first.cases).toHaveLength(32);
    expect(new Set(first.cases.map((item) => item.manifest.caseId)).size).toBe(32);
    expect(first.contentHash).toMatch(/^[0-9a-f]{64}$/u);
    expect(second.contentHash).toBe(first.contentHash);
  });

  it("evaluates every committed case to its reviewed ground-truth label", async () => {
    const result = await evaluateValidationCorpus(
      await loadValidationCorpus(CORPUS_ROOT),
      PROVENANCE,
    );

    expect(result.coverage.totalCases).toBe(32);
    expect(result.coverage.representedScannerFamilies).toEqual(["iac", "jsts", "secrets"]);
    expect(result.coverage.representedRuleIds).toEqual(EXPECTED_RULE_IDS);
    expect(result.aggregate.counts).toEqual({
      tp: 16,
      fn: 0,
      fp: 0,
      tn: 16,
      error: 0,
      unsupported: 0,
      contractMismatch: 0,
    });
    expect(result.cases).toHaveLength(32);
    expect(result.interpretation).toBe(
      "Metrics describe only the committed covered corpus and are not global ScopeForge accuracy.",
    );
  });
});
