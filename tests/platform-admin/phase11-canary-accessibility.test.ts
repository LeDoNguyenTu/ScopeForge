import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = () => readFileSync(
  join(process.cwd(), "components/platform-admin/Phase11CanaryForm.tsx"),
  "utf8",
);

describe("Phase 11 canary form accessibility", () => {
  it("announces asynchronous state without changing canary authority", () => {
    const form = source();

    expect(form).toContain('aria-busy={pending}');
    expect(form).toContain('aria-describedby="phase11-canary-help phase11-canary-status"');
    expect(form).toContain('id="phase11-canary-help"');
    expect(form).toContain('id="phase11-canary-status"');
    expect(form).toContain('aria-live="polite"');
    expect(form).toContain('role={state && !state.ok ? "alert" : "status"}');

    expect(form).toContain('name="assetId"');
    expect(form).toContain("Run bounded canary");
  });
});
