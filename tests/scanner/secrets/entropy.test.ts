import { describe, expect, it } from "vitest";

import { shannonEntropy } from "@/packages/scanner-secrets/entropy/shannon";
import { scanSecretText } from "@/packages/scanner-secrets/scan-file";

describe("secret entropy heuristics", () => {
  it("measures repeated values lower than mixed values", () => {
    expect(shannonEntropy("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")).toBeLessThan(1);
    expect(shannonEntropy("mK9pQ2vL7xR4tY8uW5nC1aB6dF3hJ0sZ")).toBeGreaterThan(3.5);
  });

  it("detects only contextual high-entropy assignments", () => {
    const highEntropy = "mK9pQ2vL7xR4tY8uW5nC1aB6dF3hJ0sZ";
    const content = [
      `const apiToken = "${highEntropy}";`,
      `const randomLabel = "${highEntropy}";`,
      'const password = "example-placeholder-value-123456";',
      'const api_key = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";'
    ].join("\n");

    const findings = scanSecretText({ file: "src/config.ts", content });
    expect(findings.map((finding) => finding.ruleId)).toEqual(["secrets/high-entropy-assignment"]);
    expect(JSON.stringify(findings)).not.toContain(highEntropy);
  });
});
