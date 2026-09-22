import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const fourthCanaryRunId = "2409c669-306b-4a7f-bf83-e3bcf1efc0cc";

describe("Phase 11 final operations helpers", () => {
  it("treats the fourth preserved canary as historical for the next authorized run", async () => {
    const [preflight, evidence] = await Promise.all([
      readFile("scripts/phase11-final-preflight.sql", "utf8"),
      readFile("scripts/phase11-final-evidence.sql", "utf8"),
    ]);

    expect(preflight).toContain("phase11_task_count = 4");
    expect(evidence).toContain(`'${fourthCanaryRunId}'::uuid`);
    expect(evidence).toContain("The four known terminal canaries are excluded explicitly");
  });

  it("keeps both helpers read-only", async () => {
    const sql = await Promise.all([
      readFile("scripts/phase11-final-preflight.sql", "utf8"),
      readFile("scripts/phase11-final-evidence.sql", "utf8"),
    ]);
    for (const helper of sql) {
      expect(helper).not.toMatch(/^\s*(?:insert|update|delete|alter|create|drop|truncate)\b/im);
    }
  });
});
