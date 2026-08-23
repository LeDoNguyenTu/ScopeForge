import { describe, expect, it } from "vitest";

import { createFindingFingerprint } from "@/packages/scanner-core/findings/fingerprint";

describe("createFindingFingerprint", () => {
  it("is deterministic for the same structural identity", () => {
    const identity = {
      scanner: "jsts",
      ruleId: "command-injection",
      file: "src/api/export.ts",
      structuralContext: "exec(request.query.cmd)",
      source: "request.query.cmd",
      sink: "child_process.exec"
    };

    const first = createFindingFingerprint(identity);
    const second = createFindingFingerprint({ ...identity });

    expect(first).toMatch(/^sf1:[a-f0-9]{64}$/);
    expect(second).toBe(first);
  });

  it("normalizes path separators and namespace casing", () => {
    const unix = createFindingFingerprint({
      scanner: "JSTS",
      ruleId: "COMMAND-INJECTION",
      file: "src/api/export.ts",
      structuralContext: " exec(request.query.cmd) "
    });
    const windows = createFindingFingerprint({
      scanner: "jsts",
      ruleId: "command-injection",
      file: "src\\api\\export.ts",
      structuralContext: "exec(request.query.cmd)"
    });

    expect(windows).toBe(unix);
  });

  it("changes when structural identity changes", () => {
    const base = {
      scanner: "jsts",
      ruleId: "command-injection",
      file: "src/api/export.ts",
      structuralContext: "exec(request.query.cmd)"
    };

    expect(createFindingFingerprint(base)).not.toBe(
      createFindingFingerprint({
        ...base,
        structuralContext: "exec(request.body.cmd)"
      })
    );
  });
});
