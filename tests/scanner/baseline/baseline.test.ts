import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { applyBaseline } from "@/packages/scanner-core/baseline/apply";
import { loadBaseline } from "@/packages/scanner-core/baseline/load";
import { serializeBaseline } from "@/packages/scanner-core/baseline/serialize";
import type { Finding } from "@/packages/scanner-core/findings/types";

const tempPaths: string[] = [];

async function tempDir(prefix: string) {
  const path = await mkdtemp(join(tmpdir(), prefix));
  tempPaths.push(path);
  return path;
}

function finding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: "sf1:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    fingerprint: "sf1:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    scanner: "jsts",
    ruleId: "jsts/dynamic-code-execution",
    ruleVersion: "1.0.0",
    title: "Dynamic code execution",
    description: "generic description",
    severity: "medium",
    confidence: "high",
    category: "code",
    validation: "static_confirmed",
    provenance: "observed",
    location: { file: "src/a.ts", startLine: 4, startColumn: 1, endLine: 4, endColumn: 5 },
    evidence: { summary: "DO_NOT_COPY_EVIDENCE", redactedSnippet: "DO_NOT_COPY_SNIPPET" },
    cwe: ["CWE-95"],
    owasp: [],
    references: [],
    remediation: {
      summary: "DO_NOT_COPY_REMEDIATION",
      guidance: "DO_NOT_COPY_GUIDANCE",
      verification: "DO_NOT_COPY_VERIFICATION"
    },
    metadata: { arbitrary: "DO_NOT_COPY_METADATA" },
    baselineState: "none",
    ...overrides
  };
}

afterEach(async () => {
  await Promise.all(tempPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("baseline contract", () => {
  it("serializes deterministic safe finding identity without evidence or arbitrary finding data", () => {
    const secret = finding({
      id: `sfs1:${"b".repeat(64)}`,
      fingerprint: `sfs1:${"b".repeat(64)}`,
      scanner: "secrets",
      ruleId: "secrets/github-token",
      ruleVersion: "1.0.0",
      severity: "high",
      location: { file: "src/secret.ts", startLine: 9, startColumn: 1, endLine: 9, endColumn: 2 },
      evidence: { summary: "SECRET_VALUE_SENTINEL_91d2" }
    });
    const normal = finding();

    const first = serializeBaseline([secret, normal], { toolVersion: "0.1.0" });
    const second = serializeBaseline([normal, secret], { toolVersion: "0.1.0" });
    expect(second).toBe(first);

    const parsed = JSON.parse(first);
    expect(parsed).toEqual({
      version: 1,
      tool: { name: "ScopeForge", version: "0.1.0" },
      entries: [
        {
          fingerprint: normal.fingerprint,
          scanner: "jsts",
          ruleId: "jsts/dynamic-code-execution",
          ruleVersion: "1.0.0",
          severity: "medium",
          file: "src/a.ts"
        },
        {
          fingerprint: secret.fingerprint,
          scanner: "secrets",
          ruleId: "secrets/github-token",
          ruleVersion: "1.0.0",
          severity: "high",
          file: "src/secret.ts"
        }
      ]
    });
    expect(first).not.toContain("SECRET_VALUE_SENTINEL_91d2");
    expect(first).not.toContain("DO_NOT_COPY_EVIDENCE");
    expect(first).not.toContain("DO_NOT_COPY_SNIPPET");
    expect(first).not.toContain("DO_NOT_COPY_METADATA");
    expect(first).not.toContain("DO_NOT_COPY_GUIDANCE");
  });

  it("loads version 1 baselines and labels findings without mutating the originals", async () => {
    const root = await tempDir("scopeforge-baseline-load-");
    const existing = finding();
    await writeFile(join(root, ".scopeforge-baseline.json"), serializeBaseline([existing]));

    const baseline = await loadBaseline(root, ".scopeforge-baseline.json");
    const fresh = finding({
      id: `sf1:${"c".repeat(64)}`,
      fingerprint: `sf1:${"c".repeat(64)}`,
      location: { file: "src/b.ts", startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 }
    });
    const applied = applyBaseline([existing, fresh], baseline);

    expect(applied.findings.map((item) => item.baselineState)).toEqual(["existing", "new"]);
    expect(applied.resolved).toEqual([]);
    expect(existing.baselineState).toBe("none");
    expect(fresh.baselineState).toBe("none");
  });

  it("fails closed on malformed, incompatible, oversized, and symlinked baselines", async () => {
    const root = await tempDir("scopeforge-baseline-invalid-");
    const path = join(root, ".scopeforge-baseline.json");

    await writeFile(path, "{ invalid json");
    await expect(loadBaseline(root, ".scopeforge-baseline.json")).rejects.toMatchObject({ code: "invalid_baseline" });

    await writeFile(path, JSON.stringify({ version: 2, entries: [] }));
    await expect(loadBaseline(root, ".scopeforge-baseline.json")).rejects.toMatchObject({ code: "invalid_baseline" });

    await writeFile(path, "x".repeat(4 * 1024 * 1024 + 1));
    await expect(loadBaseline(root, ".scopeforge-baseline.json")).rejects.toMatchObject({ code: "baseline_too_large" });

    await rm(path);
    const outside = await tempDir("scopeforge-baseline-outside-");
    const victim = join(outside, "baseline.json");
    await writeFile(victim, serializeBaseline([finding()]));
    await symlink(victim, path);
    await expect(loadBaseline(root, ".scopeforge-baseline.json")).rejects.toMatchObject({ code: "unsafe_baseline" });
    expect(await readFile(victim, "utf8")).toContain("ScopeForge");
  });
});
