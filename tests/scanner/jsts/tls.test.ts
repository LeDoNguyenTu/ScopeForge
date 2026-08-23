import { describe, expect, it } from "vitest";

import { scanJavaScriptText } from "@/packages/scanner-jsts/scan-source";

describe("JavaScript TLS verification structural rule", () => {
  it("detects statically disabled TLS verification", () => {
    const findings = scanJavaScriptText({
      file: "src/tls.ts",
      content: [
        "const agent = { rejectUnauthorized: false };",
        "process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';"
      ].join("\n")
    });

    expect(findings.map((finding) => finding.ruleId)).toEqual([
      "jsts/tls-verification-disabled",
      "jsts/tls-verification-disabled"
    ]);
  });

  it("does not flag safe or dynamic values", () => {
    const findings = scanJavaScriptText({
      file: "src/tls.ts",
      content: [
        "const safe = { rejectUnauthorized: true };",
        "const dynamic = { rejectUnauthorized: tlsPolicy };",
        "const text = 'rejectUnauthorized: false';",
        "process.env.NODE_TLS_REJECT_UNAUTHORIZED = configuredValue;"
      ].join("\n")
    });

    expect(findings).toEqual([]);
  });
});
