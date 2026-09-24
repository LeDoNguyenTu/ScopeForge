import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MfaPage from "@/app/auth/mfa/page";
import AccountSecurityPage from "@/app/dashboard/settings/security/page";

const mocks = vi.hoisted(() => ({
  getDashboardContext: vi.fn(),
  getUser: vi.fn(),
  getAal: vi.fn(),
  listFactors: vi.fn(),
  getOptionalPlatformAdmin: vi.fn(),
  redirect: vi.fn((destination: string) => { throw new Error(`NEXT_REDIRECT:${destination}`); }),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: {
  getUser: mocks.getUser,
  mfa: { getAuthenticatorAssuranceLevel: mocks.getAal, listFactors: mocks.listFactors },
} }) }));
vi.mock("@/lib/workspaces/current", () => ({ getDashboardContext: mocks.getDashboardContext }));
vi.mock("@/lib/platform-admin/authorization", () => ({ getOptionalPlatformAdmin: mocks.getOptionalPlatformAdmin }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect, usePathname: () => "/dashboard/settings/security" }));
vi.mock("@/components/auth/MfaChallengeForm", () => ({ default: () => <div>MFA challenge form</div> }));
vi.mock("@/components/auth/AccountSecurityPanel", () => ({ default: () => <div>Account security controls</div> }));
vi.mock("@/app/actions", () => ({ signOut: vi.fn() }));

function setAssurance({ verified }: { verified: boolean }) {
  mocks.getAal.mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: verified ? "aal2" : "aal1" }, error: null });
  mocks.listFactors.mockResolvedValue({ data: { totp: verified ? [
    { id: "factor-1", friendly_name: "Authenticator", status: "verified" },
  ] : [] }, error: null });
}

describe("privileged MFA pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getOptionalPlatformAdmin.mockResolvedValue(null);
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mocks.getDashboardContext.mockResolvedValue({
      user: { email: "owner@example.com" },
      workspace: { id: "workspace-1", name: "Security workspace" },
      role: "owner",
      displayName: "Owner",
      supabase: { auth: { mfa: { getAuthenticatorAssuranceLevel: mocks.getAal, listFactors: mocks.listFactors } } },
    });
  });

  it("does not offer an account-security escape from an active MFA challenge", async () => {
    setAssurance({ verified: true });
    render(await MfaPage({ searchParams: Promise.resolve({ next: "/dashboard" }) }));

    expect(screen.getByText("MFA challenge form")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Manage account security" })).not.toBeInTheDocument();
  });

  it("redirects a privileged AAL1 session with a verified factor back to the challenge", async () => {
    setAssurance({ verified: true });

    await expect(AccountSecurityPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("NEXT_REDIRECT:/auth/mfa?next=%2Fdashboard%2Fsettings%2Fsecurity");
  });

  it("keeps first-time privileged enrollment available without dashboard navigation", async () => {
    mocks.getOptionalPlatformAdmin.mockResolvedValue({ role: "admin" });
    setAssurance({ verified: false });
    render(await AccountSecurityPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByText("Account security controls")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Dashboard command navigation" })).not.toBeInTheDocument();
  });

  it("does not lock a workspace owner without factors into enrollment", async () => {
    setAssurance({ verified: false });
    render(await AccountSecurityPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("navigation", { name: "Dashboard command navigation" })).toBeInTheDocument();
  });

  it("redirects stale required-enrollment links once AAL2 is established", async () => {
    setAssurance({ verified: true });
    mocks.getAal.mockResolvedValue({ data: { currentLevel: "aal2", nextLevel: "aal2" }, error: null });
    await expect(AccountSecurityPage({ searchParams: Promise.resolve({ required: "mfa" }) })).rejects.toThrow("NEXT_REDIRECT:/dashboard");
  });
});
