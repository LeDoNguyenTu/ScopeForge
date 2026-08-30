import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PublicNav from "@/components/landing/PublicNav";

describe("PublicNav", () => {
  it("shows only destinations that actually exist", () => {
    render(<PublicNav />);

    expect(screen.getAllByRole("link", { name: /^product$/i })[0]).toHaveAttribute("href", "#platform");
    expect(screen.getAllByRole("link", { name: /^security model$/i })[0]).toHaveAttribute("href", "#security-model");
    expect(screen.getAllByRole("link", { name: /^github$/i })[0]).toHaveAttribute("href", "https://github.com/LeDoNguyenTu/ScopeForge");
    expect(screen.getAllByRole("link", { name: /^sign in$/i })[0]).toHaveAttribute("href", "/auth/sign-in");
    expect(screen.getAllByRole("link", { name: /create workspace/i })[0]).toHaveAttribute("href", "/auth/sign-up");

    expect(screen.queryByText("Pricing")).not.toBeInTheDocument();
    expect(screen.queryByText("Company")).not.toBeInTheDocument();
    expect(screen.queryByText("Use Cases")).not.toBeInTheDocument();
  });
});
