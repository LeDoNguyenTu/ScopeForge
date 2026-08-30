import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AppShell from "@/components/AppShell";

vi.mock("@/app/actions", () => ({
  signOut: vi.fn(),
}));

vi.mock("@/components/SideNav", () => ({
  default: () => <nav aria-label="Workspace navigation">Default nav</nav>,
}));

describe("AppShell", () => {
  const props = {
    displayName: "Brian",
    workspaceName: "ScopeForge Lab",
    role: "owner",
  };

  it("preserves the existing sidebar shell by default", () => {
    render(<AppShell {...props}><p>Dashboard content</p></AppShell>);

    expect(screen.getByRole("complementary")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Workspace navigation" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Dashboard command navigation" })).not.toBeInTheDocument();
    expect(screen.getByText("Dashboard content")).toBeInTheDocument();
  });

  it("renders the immersive floating command navigation without the left sidebar", () => {
    render(<AppShell {...props} variant="immersive"><p>Immersive content</p></AppShell>);

    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Dashboard command navigation" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("link", { name: "Assets" })).toHaveAttribute("href", "/dashboard/assets");
    expect(screen.getByRole("link", { name: "Findings" })).toHaveAttribute("href", "/dashboard/findings");
    expect(screen.getByText("ScopeForge Lab")).toBeInTheDocument();
    expect(screen.getByText("Immersive content")).toBeInTheDocument();
  });
});
