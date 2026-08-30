import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LandingBootGate, { useLandingBoot } from "@/components/landing/LandingBootGate";
import { READY_STORAGE_KEY, SCENE_VERSION } from "@/components/landing/attack-surface/progress";

function ReadyProbe() {
  const boot = useLandingBoot();
  return (
    <div>
      <span>Landing</span>
      <button type="button" onClick={() => boot.reportProgress(82, "Preparing materials")}>Progress</button>
      <button type="button" onClick={() => boot.markReady()}>Ready</button>
    </div>
  );
}

beforeEach(() => {
  window.localStorage.clear();
  vi.useRealTimers();
});

describe("LandingBootGate", () => {
  it("shows truthful boot UI when the scene version is cold", () => {
    render(<LandingBootGate><ReadyProbe /></LandingBootGate>);
    expect(screen.getByText(/preparing living attack surface/i)).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
    expect(screen.queryByText(/cloudflare/i)).not.toBeInTheDocument();
  });

  it("does not block a warm repeat visit", async () => {
    window.localStorage.setItem(READY_STORAGE_KEY, SCENE_VERSION);
    render(<LandingBootGate><ReadyProbe /></LandingBootGate>);

    await waitFor(() => expect(screen.queryByText(/preparing living attack surface/i)).not.toBeInTheDocument());
    expect(screen.getByText("Landing")).toBeVisible();
  });

  it("stores readiness only after the renderer reports a stable frame", async () => {
    render(<LandingBootGate><ReadyProbe /></LandingBootGate>);
    expect(window.localStorage.getItem(READY_STORAGE_KEY)).toBeNull();

    await act(async () => {
      screen.getByRole("button", { name: "Progress" }).click();
    });
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "82");
    expect(window.localStorage.getItem(READY_STORAGE_KEY)).toBeNull();

    await act(async () => {
      screen.getByRole("button", { name: "Ready" }).click();
    });

    await waitFor(() => expect(screen.queryByText(/preparing living attack surface/i)).not.toBeInTheDocument());
    expect(window.localStorage.getItem(READY_STORAGE_KEY)).toBe(SCENE_VERSION);
  });
});
