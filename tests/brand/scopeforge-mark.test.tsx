import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ScopeForgeMark from "@/components/brand/ScopeForgeMark";
import ScopeForgeWordmark from "@/components/brand/ScopeForgeWordmark";

describe("ScopeForge brand", () => {
  it("renders a labeled mark when title is provided", () => {
    render(<ScopeForgeMark title="ScopeForge" />);
    expect(screen.getByRole("img", { name: "ScopeForge" })).toBeInTheDocument();
  });

  it("hides the mark from assistive technology when no title is provided", () => {
    const { container } = render(<ScopeForgeMark />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("renders the ScopeForge wordmark text", () => {
    render(<ScopeForgeWordmark />);
    expect(screen.getByText("ScopeForge")).toBeInTheDocument();
  });
});
