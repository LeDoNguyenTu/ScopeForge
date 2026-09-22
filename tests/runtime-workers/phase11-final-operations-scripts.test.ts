import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const fourthCanaryRunId = "2409c669-306b-4a7f-bf83-e3bcf1efc0cc";
const acceptedFifthCanaryRunId = "37fb0091-a7b2-4a33-8a24-6136deb61143";

describe("Phase 11 final operations helpers", () => {
  it("treats all five preserved canaries as historical for any later authorized run", async () => {
    const [preflight, evidence] = await Promise.all([
      readFile("scripts/phase11-final-preflight.sql", "utf8"),
      readFile("scripts/phase11-final-evidence.sql", "utf8"),
    ]);

    expect(preflight).toContain("phase11_task_count = 5");
    expect(evidence).toContain(`'${fourthCanaryRunId}'::uuid`);
    expect(evidence).toContain(`'${acceptedFifthCanaryRunId}'::uuid`);
    expect(evidence).toContain("The five known terminal canaries are excluded explicitly");
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
