export const TRIAL_LIMITS = {
  assetsPerWorkspace: 10,
  verificationAttemptsPerAssetPerHour: 5,
  verificationAttemptsPerWorkspacePerDay: 100,
  concurrentScanJobsPerWorkspace: 0
} as const;

export type QuotaErrorCode = "ASSET_LIMIT_REACHED" | "VERIFICATION_RATE_LIMITED";

export class QuotaError extends Error {
  readonly code: QuotaErrorCode;

  constructor(code: QuotaErrorCode, message: string) {
    super(message);
    this.name = "QuotaError";
    this.code = code;
  }
}

export function assertCanRegisterAsset(currentCount: number): void {
  if (!Number.isInteger(currentCount) || currentCount < 0) throw new Error("Asset count must be a non-negative integer.");
  if (currentCount >= TRIAL_LIMITS.assetsPerWorkspace) {
    throw new QuotaError(
      "ASSET_LIMIT_REACHED",
      `This trial workspace can register up to ${TRIAL_LIMITS.assetsPerWorkspace} assets.`
    );
  }
}

export function assertCanAttemptVerification(input: {
  assetAttemptsLastHour: number;
  workspaceAttemptsToday: number;
}): void {
  const { assetAttemptsLastHour, workspaceAttemptsToday } = input;
  if (![assetAttemptsLastHour, workspaceAttemptsToday].every((value) => Number.isInteger(value) && value >= 0)) {
    throw new Error("Verification counters must be non-negative integers.");
  }
  if (
    assetAttemptsLastHour >= TRIAL_LIMITS.verificationAttemptsPerAssetPerHour ||
    workspaceAttemptsToday >= TRIAL_LIMITS.verificationAttemptsPerWorkspacePerDay
  ) {
    throw new QuotaError(
      "VERIFICATION_RATE_LIMITED",
      "Verification is temporarily rate limited for this asset or workspace. Try again later."
    );
  }
}
