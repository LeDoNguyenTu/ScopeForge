import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AppShell from "@/components/AppShell";

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
    expect(screen.getByRole("link", { name: "Workspace" })).toHaveAttribute("href", "/dashboard/workspace");
    expect(screen.getByText("ScopeForge Lab")).toBeInTheDocument();
    expect(screen.getByText("Immersive content")).toBeInTheDocument();
  });

  it("separates the platform administration control from ordinary resources", () => {
    render(<AppShell {...props} platformAdminHref="/admin"><p>Content</p></AppShell>);
    const admin = screen.getByRole("link", { name: "Platform admin" });
    expect(admin).toHaveClass("workspaceAdminButton");
    expect(admin).toHaveAttribute("href", "/admin");
    expect(admin.parentElement).toHaveClass("workspaceToolbarActions");
  });
});
