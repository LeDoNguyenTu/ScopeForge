import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const actionPath = path.resolve(
  process.cwd(),
  "app/dashboard/assets/[assetId]/active-validation-actions.ts",
);

describe("active validation server action authority", () => {
  it("routes the hosted request through the closed Phase 6D request boundary", async () => {
    const source = await readFile(actionPath, "utf8");

    expect(source).toContain("requestActiveCorsRuntimeWorker");
    expect(source).not.toContain("executeActiveValidation");
    expect(source).not.toContain("enqueueActiveValidation");
    expect(source).toContain("explicitConsent");
    expect(source).toMatch(/runCorsOriginPolicyValidation\(\s*assetId: string,\s*explicitConsent: boolean/);
    expect(source).not.toMatch(/export async function runCorsOriginPolicyValidation\([^)]*(url|origin|headers|method|profile|budget|worker|executionClass)/i);
    expect(source).not.toContain("SCOPEFORGE_SYNTHETIC_ORIGIN");
    expect(source).not.toContain("TrustedRuntimeRequestPlan");
    expect(source).not.toMatch(/runtime-network|node:https|node:tls|node:dns|\bfetch\s*\(/);
  });

  it("uses a separate cancellation action scoped by job id only", async () => {
    const source = await readFile(actionPath, "utf8");

    expect(source).toMatch(/cancelActiveValidation\(\s*jobId: string/);
    expect(source).toContain("requestActiveValidationCancellation");
  });
});
