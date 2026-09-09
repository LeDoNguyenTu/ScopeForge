import { describe, expect, it } from "vitest";

import {
  evaluateValidationCorpus,
  loadValidationCorpus,
  renderValidationAccuracyMarkdown,
  serializeValidationAccuracyJson,
  type ValidationProvenance,
} from "@/packages/validation-accuracy";
import { vulnerableCase, writeCorpus } from "./task1-helpers";

const PROVENANCE: ValidationProvenance = {
  scopeforgeVersion: "0.1.0",
  commitSha: "a".repeat(40),
  nodeVersion: "v22.0.0",
  platform: "linux",
  arch: "x64",
};

describe("validation report privacy", () => {
  it("does not leak fixture contents, synthetic credentials, scanner detail, or absolute roots", async () => {
    const sourceSentinel = "SOURCE_CONTENT_SENTINEL_DO_NOT_REPORT";
    const classicSynthetic = "ghp_0123456789abcdefghijklmnopqrstuvwxyz";
    const fineGrainedSynthetic = "github_pat_0123456789abcdefghij";
    const remediationText = "Remove direct dynamic code execution where practical.";
    const root = await writeCorpus([
      {
        directory: "cases/jsts-dynamic-positive-eval",
        manifest: vulnerableCase("jsts-dynamic-positive-eval"),
        files: {
          "src/app.ts": [
            `const marker = ${JSON.stringify(sourceSentinel)};`,
            `const classic = ${JSON.stringify(classicSynthetic)};`,
            `const fineGrained = ${JSON.stringify(fineGrainedSynthetic)};`,
            "eval(input);",
          ].join("\n"),
        },
      },
    ]);
    const result = await evaluateValidationCorpus(await loadValidationCorpus(root), PROVENANCE);
    const json = serializeValidationAccuracyJson(result);
    const markdown = renderValidationAccuracyMarkdown(result);

    for (const output of [json, markdown]) {
      expect(output).not.toContain(sourceSentinel);
      expect(output).not.toContain(classicSynthetic);
      expect(output).not.toContain(fineGrainedSynthetic);
      expect(output).not.toContain(root);
      expect(output).not.toContain(remediationText);
      expect(output).not.toContain("redactedSnippet");
      expect(output).not.toContain("evidence");
      expect(output).not.toContain("metadata");
      expect(output).not.toContain("remediation");
      expect(output).not.toContain("startedAt");
      expect(output).not.toContain("completedAt");
      expect(output).not.toContain("durationMs");
    }
  });
});
