import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  HOSTED_PHASE3_SCANNER_DESCRIPTORS,
  runHostedRepositoryScan,
} from "@/packages/hosted-scanner-runner";

async function withRepository(
  files: Record<string, string>,
  callback: (root: string) => Promise<void>,
): Promise<void> {
  const root = await mkdtemp(path.join(tmpdir(), "scopeforge-hosted-runner-"));
  try {
    for (const [repositoryPath, content] of Object.entries(files)) {
      const destination = path.join(root, ...repositoryPath.split("/"));
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, content);
    }
    await callback(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

describe("Phase 6C hosted scanner runner", () => {
  it("uses the closed built-in scanner profile and privacy-reduced hosted output", async () => {
    await withRepository({
      "src/config.ts": `export const token = "ghp_${"a".repeat(36)}";\n`,
      ".scopeforge.json": JSON.stringify({ scanners: [] }),
    }, async (root) => {
      const envelope = await runHostedRepositoryScan({
        root,
        canonicalRepositoryUrl: "https://github.com/octocat/Hello-World",
      });

      expect(HOSTED_PHASE3_SCANNER_DESCRIPTORS).toEqual([
        "iac@1.0.0",
        "jsts@1.0.0",
        "sca@1.0.0",
        "secrets@1.0.0",
      ]);
      expect(envelope.scan.scanners).toEqual(HOSTED_PHASE3_SCANNER_DESCRIPTORS);
      expect(envelope.scan.scannerErrorCount).toBe(0);
      expect(envelope.findings.some((finding) => finding.ruleId === "secrets/github-token")).toBe(true);
      const secret = envelope.findings.find((finding) => finding.ruleId === "secrets/github-token");
      expect(secret?.location).toEqual({ path: "src/config.ts", line: 1 });
      expect(JSON.stringify(secret)).not.toContain(`ghp_${"a".repeat(36)}`);
    });
  });

  it("fails closed instead of publishing partial output when any scanner reports diagnostics", async () => {
    await withRepository({
      "src/broken.ts": "export const = ;\n",
    }, async (root) => {
      await expect(runHostedRepositoryScan({
        root,
        canonicalRepositoryUrl: "https://github.com/octocat/Hello-World",
      })).rejects.toThrow(/scanner diagnostics/i);
    });
  });
});