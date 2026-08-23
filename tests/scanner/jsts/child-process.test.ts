import { describe, expect, it } from "vitest";

import { scanJavaScriptText } from "@/packages/scanner-jsts/scan-source";

describe("JavaScript child-process structural rule", () => {
  it("detects exec APIs and shell-enabled spawn tied to child_process", () => {
    const findings = scanJavaScriptText({
      file: "src/process.ts",
      content: [
        "import { exec, spawn } from 'node:child_process';",
        "const cp = require('child_process');",
        "exec(command);",
        "cp.execSync(command);",
        "spawn('tool', [], { shell: true });",
        "cp.spawnSync('tool', [], { shell: true });"
      ].join("\n")
    });

    expect(findings.map((finding) => finding.ruleId)).toEqual([
      "jsts/unsafe-child-process",
      "jsts/unsafe-child-process",
      "jsts/unsafe-child-process",
      "jsts/unsafe-child-process"
    ]);
  });

  it("does not flag unrelated local functions or spawn without a static shell", () => {
    const findings = scanJavaScriptText({
      file: "src/process.ts",
      content: [
        "function exec(value: string) { return value; }",
        "exec('safe');",
        "import { spawn } from 'node:child_process';",
        "spawn('tool', []);",
        "spawn('tool', [], { shell: false });",
        "spawn('tool', [], options);"
      ].join("\n")
    });

    expect(findings).toEqual([]);
  });
});
