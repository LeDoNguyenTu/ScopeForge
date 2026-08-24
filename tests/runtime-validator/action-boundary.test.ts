import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const actionPath = path.resolve(
  process.cwd(),
  "app/dashboard/assets/[assetId]/active-validation-actions.ts",
);

describe("active validation server action authority", () => {
  it("keeps profile, target policy, request configuration, and budget server-controlled", async () => {
    const source = await readFile(actionPath, "utf8");

    expect(source).toContain("ACTIVE_VALIDATION_MAX_BUDGET");
    expect(source).toContain("enqueueActiveValidation");
    expect(source).toContain("executeActiveValidation");
    expect(source).toContain("explicitConsent");
    expect(source).toMatch(/runCorsOriginPolicyValidation\(\s*assetId: string,\s*explicitConsent: boolean/);
    expect(source).not.toMatch(/export async function runCorsOriginPolicyValidation\([^)]*(url|origin|headers|method|profile|budget)/i);
    expect(source).not.toContain("SCOPEFORGE_SYNTHETIC_ORIGIN");
    expect(source).not.toContain("TrustedRuntimeRequestPlan");
  });

  it("uses a separate cancellation action scoped by job id only", async () => {
    const source = await readFile(actionPath, "utf8");

    expect(source).toMatch(/cancelActiveValidation\(\s*jobId: string/);
    expect(source).toContain("requestActiveValidationCancellation");
  });
});
