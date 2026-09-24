import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AppShell from "@/components/AppShell";

const mocks = vi.hoisted(() => ({ listFactors: vi.fn(), onAuthStateChange: vi.fn(), unsubscribe: vi.fn() }));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { mfa: { listFactors: mocks.listFactors }, onAuthStateChange: mocks.onAuthStateChange } }),
}));

vi.mock("@/app/actions", () => ({
  signOut: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/assets/example",
}));

describe("AppShell", () => {
  const props = {
    displayName: "Brian",
    workspaceName: "ScopeForge Lab",
    role: "owner",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    mocks.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: mocks.unsubscribe } } });
    mocks.listFactors.mockResolvedValue({
      data: { all: [], phone: [], totp: [], webauthn: [], recovery_code: [] },
      error: null,
    });
  });

  it("uses the same accessible command navigation on detail pages", () => {
    render(<AppShell {...props}><p>Dashboard content</p></AppShell>);

    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Workspace navigation" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Dashboard command navigation" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Assets" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Skip to content" })).toHaveAttribute("href", "#workspace-content");
    expect(screen.getByRole("main")).toHaveAttribute("id", "workspace-content");
    expect(screen.getByText("Dashboard content")).toBeInTheDocument();
  });

  it("preserves all workspace destinations in the shared navigation shell", () => {
    render(<AppShell {...props} variant="immersive"><p>Immersive content</p></AppShell>);

    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Dashboard command navigation" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("link", { name: "Assets" })).toHaveAttribute("href", "/dashboard/assets");
    expect(screen.getByRole("link", { name: "Findings" })).toHaveAttribute("href", "/dashboard/findings");
    expect(screen.getByRole("link", { name: "Security runs" })).toHaveAttribute("href", "/dashboard/security-runs");
    expect(screen.getByRole("link", { name: "Workspace" })).toHaveAttribute("href", "/dashboard/workspace");
    expect(screen.getByRole("link", { name: "Account & security" })).toHaveAttribute("href", "/dashboard/settings/security");
    expect(screen.getByRole("link", { name: "Account & security for Brian" })).toHaveAttribute("href", "/dashboard/settings/security");
    expect(screen.getByText("ScopeForge Lab")).toBeInTheDocument();
    expect(screen.getByText("Immersive content")).toBeInTheDocument();
  });

  it("keeps the active horizontal workspace destination visible when navigation changes", async () => {
    const source = await import("node:fs/promises").then(({ readFile }) => readFile("components/SideNav.tsx", "utf8"));
    expect(source).toContain('closest(".immersiveDashboardLinks")');
    expect(source).toContain("rail.scrollTo");
    expect(source).toContain('pathname === "/preview/security-runs"');
    expect(source).toContain("activeLinkRef");
  });

  it("separates the platform administration control from ordinary resources", () => {
    render(<AppShell {...props} platformAdminHref="/admin"><p>Content</p></AppShell>);
    const admin = screen.getByRole("link", { name: "Platform admin" });
    expect(admin).toHaveClass("workspaceAdminButton");
    expect(admin).toHaveAttribute("href", "/admin");
    expect(admin.parentElement).toHaveClass("workspaceToolbarActions");
  });

  it.each(["owner", "admin", "member", "viewer"])("offers %s an optional, live-updating MFA recommendation", async (role) => {
    render(<AppShell {...props} role={role}><p>Viewer dashboard</p></AppShell>);

    const recommendation = await screen.findByRole("status", { name: "Two-step verification recommendation" });
    expect(screen.getByText("Viewer dashboard")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Set up two-step verification" })).toHaveAttribute("href", "/dashboard/settings/security");

    act(() => mocks.onAuthStateChange.mock.calls[0][0]("MFA_CHALLENGE_VERIFIED"));
    expect(recommendation).not.toBeInTheDocument();
  });

  it("allows a user to dismiss the recommendation", async () => {
    render(<AppShell {...props} role="viewer"><p>Content</p></AppShell>);
    fireEvent.click(await screen.findByRole("button", { name: "Dismiss MFA recommendation" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
