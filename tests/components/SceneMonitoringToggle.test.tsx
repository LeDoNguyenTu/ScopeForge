import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SceneMonitoringToggle from "@/components/landing/SceneMonitoringToggle";

describe("SceneMonitoringToggle", () => {
  it("toggles only the illustrative landing animation", () => {
    const listener = vi.fn();
    window.addEventListener("scopeforge:attack-surface-pause", listener);
    render(<SceneMonitoringToggle />);

    const button = screen.getByRole("button", { name: /pause animation/i });
    expect(button).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(button);
    expect(screen.getByRole("button", { name: /resume animation/i })).toHaveAttribute("aria-pressed", "true");
    expect(listener).toHaveBeenCalledTimes(1);

    window.removeEventListener("scopeforge:attack-surface-pause", listener);
  });
});
