import { describe, expect, it } from "vitest";
import {
  assertCanAttemptVerification,
  assertCanRegisterAsset,
  QuotaError,
  TRIAL_LIMITS
} from "@/lib/quotas/limits";

describe("asset trial limits", () => {
  it("allows registration below the asset limit", () => {
    expect(() => assertCanRegisterAsset(TRIAL_LIMITS.assetsPerWorkspace - 1)).not.toThrow();
  });

  it("rejects registration at the exact asset limit with a stable code", () => {
    try {
      assertCanRegisterAsset(TRIAL_LIMITS.assetsPerWorkspace);
      throw new Error("Expected quota rejection");
    } catch (error) {
      expect(error).toBeInstanceOf(QuotaError);
      expect((error as QuotaError).code).toBe("ASSET_LIMIT_REACHED");
    }
  });
});

describe("verification trial limits", () => {
  it("allows attempts below both verification limits", () => {
    expect(() => assertCanAttemptVerification({ assetAttemptsLastHour: 4, workspaceAttemptsToday: 99 })).not.toThrow();
  });

  it("rejects the per-asset hourly limit", () => {
    try {
      assertCanAttemptVerification({ assetAttemptsLastHour: 5, workspaceAttemptsToday: 1 });
      throw new Error("Expected quota rejection");
    } catch (error) {
      expect(error).toBeInstanceOf(QuotaError);
      expect((error as QuotaError).code).toBe("VERIFICATION_RATE_LIMITED");
    }
  });

  it("rejects the workspace daily limit", () => {
    expect(() => assertCanAttemptVerification({ assetAttemptsLastHour: 1, workspaceAttemptsToday: 100 }))
      .toThrowError(QuotaError);
  });
});
