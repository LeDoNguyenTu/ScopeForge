import { describe, expect, it, vi } from "vitest";
import { assuranceDestination, readAssuranceState } from "@/lib/auth/assurance";

const noFactors = { currentLevel: "aal1" as const, nextLevel: "aal1" as const, verifiedTotp: [], unverifiedTotp: [] };
const enrolled = { currentLevel: "aal1" as const, nextLevel: "aal2" as const, verifiedTotp: [{ id: "factor-1", friendlyName: "Authenticator" }], unverifiedTotp: [] };

describe("authentication assurance policy", () => {
  it.each(["owner", "admin"])("requires %s to enroll a verified factor", (role) => {
    expect(assuranceDestination(role, noFactors)).toBe("/dashboard/settings/security?required=mfa");
  });

  it.each(["member", "viewer"])("allows %s without an enrolled factor", (role) => {
    expect(assuranceDestination(role, noFactors)).toBeNull();
  });

  it.each(["member", "viewer"])("does not challenge an enrolled %s whose session is still AAL1", (role) => {
    expect(assuranceDestination(role, enrolled, "/dashboard/findings")).toBeNull();
  });

  it.each(["owner", "admin", "platform-admin"])("challenges an enrolled privileged %s session at AAL1", (role) => {
    expect(assuranceDestination(role, enrolled, "/dashboard/findings")).toBe("/auth/mfa?next=%2Fdashboard%2Ffindings");
  });

  it("allows an AAL2 privileged session", () => {
    expect(assuranceDestination("owner", { ...enrolled, currentLevel: "aal2" })).toBeNull();
  });

  it("normalizes provider assurance and TOTP factors", async () => {
    const auth = {
      mfa: {
        getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal2" }, error: null }),
        listFactors: vi.fn().mockResolvedValue({ data: { totp: [
          { id: "verified", friendly_name: "Work phone", status: "verified" },
          { id: "pending", friendly_name: null, status: "unverified" },
        ] }, error: null }),
      },
    };

    await expect(readAssuranceState(auth)).resolves.toEqual({
      currentLevel: "aal1",
      nextLevel: "aal2",
      verifiedTotp: [{ id: "verified", friendlyName: "Work phone" }],
      unverifiedTotp: [{ id: "pending", friendlyName: "Authenticator app" }],
    });
  });
});
