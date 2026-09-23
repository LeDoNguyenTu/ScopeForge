import { safeAuthReturnPath } from "@/lib/auth/return-path";

export type AuthenticatorFactor = {
  id: string;
  friendlyName: string;
};

export type AssuranceState = {
  currentLevel: "aal1" | "aal2" | null;
  nextLevel: "aal1" | "aal2" | null;
  verifiedTotp: AuthenticatorFactor[];
  unverifiedTotp: AuthenticatorFactor[];
};

export type MfaAuth = {
  mfa: {
    getAuthenticatorAssuranceLevel: () => Promise<{ data: { currentLevel: string | null; nextLevel: string | null } | null; error: unknown }>;
    listFactors: () => Promise<{ data: { totp?: Array<{ id: string; friendly_name?: string | null; status: string }> } | null; error: unknown }>;
  };
};

export async function readAssuranceState(auth: MfaAuth): Promise<AssuranceState> {
  const [levelResult, factorsResult] = await Promise.all([
    auth.mfa.getAuthenticatorAssuranceLevel(),
    auth.mfa.listFactors(),
  ]);
  if (levelResult.error || factorsResult.error || !levelResult.data || !factorsResult.data) {
    throw new Error("Unable to verify account security state.");
  }

  const normalize = (factor: { id: string; friendly_name?: string | null }): AuthenticatorFactor => ({
    id: factor.id,
    friendlyName: factor.friendly_name?.trim() || "Authenticator app",
  });
  const totp = factorsResult.data.totp ?? [];
  const normalizeLevel = (level: string | null): "aal1" | "aal2" | null => (
    level === "aal1" ? "aal1" : level === "aal2" ? "aal2" : null
  );

  return {
    currentLevel: normalizeLevel(levelResult.data.currentLevel),
    nextLevel: normalizeLevel(levelResult.data.nextLevel),
    verifiedTotp: totp.filter((factor) => factor.status === "verified").map(normalize),
    unverifiedTotp: totp.filter((factor) => factor.status === "unverified").map(normalize),
  };
}

export function assuranceDestination(
  role: string,
  state: AssuranceState,
  returnPath = "/dashboard",
): string | null {
  const requiresMfa = role === "owner" || role === "admin" || role === "platform-admin";
  if (!requiresMfa) return null;
  if (state.currentLevel === "aal2") return null;
  if (state.verifiedTotp.length > 0) {
    return `/auth/mfa?next=${encodeURIComponent(safeAuthReturnPath(returnPath))}`;
  }
  return "/dashboard/settings/security?required=mfa";
}
