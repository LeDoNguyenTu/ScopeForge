import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ConnectedProjectScanPanel from "@/components/assets/ConnectedProjectScanPanel";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  requestScan: vi.fn(),
  resumeScan: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

vi.mock("@/app/dashboard/assets/[assetId]/project-scan-actions", () => ({
  requestConnectedProjectSecurityScan: mocks.requestScan,
  resumeConnectedProjectSecurityScan: mocks.resumeScan,
}));

const publicProject = {
  fullName: "scopeforge-labs/app",
  defaultBranch: "main",
  isPrivate: false,
  accessStatus: "active" as const,
  projectScanState: "idle" as const,
};

function renderPanel(overrides: Partial<React.ComponentProps<typeof ConnectedProjectScanPanel>> = {}) {
  return render(
    <ConnectedProjectScanPanel
      assetId="22222222-2222-4222-8222-222222222222"
      role="owner"
      project={publicProject}
      snapshotRuntimeAvailable
      privateSnapshotRuntimeAvailable={false}
      scanRuntimeAvailable={false}
      {...overrides}
    />,
  );
}

afterEach(() => {
  mocks.refresh.mockReset();
  mocks.requestScan.mockReset();
  mocks.resumeScan.mockReset();
});

describe("ConnectedProjectScanPanel", () => {
  it("makes the connected public repository a one-click project scan", () => {
    renderPanel();
    expect(screen.getByText("scopeforge-labs/app")).toBeInTheDocument();
    expect(screen.getByText(/default branch: main/i)).toBeInTheDocument();
    expect(screen.getByText("Public")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^scan project$/i })).toBeEnabled();
    expect(screen.getByText(/scan will wait safely until the repository scan runtime is enabled/i)).toBeInTheDocument();
  });

  it("truthfully disables private acquisition when its dedicated runtime is unavailable", () => {
    renderPanel({ project: { ...publicProject, isPrivate: true } });
    expect(screen.getByText("Private")).toBeInTheDocument();
    expect(screen.getByText(/private source acquisition is disabled in this deployment/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /private snapshot runtime unavailable/i })).toBeDisabled();
  });

  it("makes a connected private repository scannable when the dedicated acquisition runtime is enabled", async () => {
    mocks.requestScan.mockResolvedValue({
      ok: true,
      status: "snapshot_queued",
      taskId: "77777777-7777-4777-8777-777777777777",
      message: "ScopeForge queued an isolated private source snapshot.",
    });
    renderPanel({
      project: { ...publicProject, isPrivate: true },
      privateSnapshotRuntimeAvailable: true,
    });

    expect(screen.getByRole("button", { name: /^scan project$/i })).toBeEnabled();
    expect(screen.getByText(/dedicated private acquisition worker/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^scan project$/i }));

    await waitFor(() => expect(mocks.requestScan).toHaveBeenCalledWith("22222222-2222-4222-8222-222222222222"));
    expect(await screen.findByText(/isolated private source snapshot/i)).toBeInTheDocument();
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("prevents duplicate user starts while snapshot orchestration is already active", () => {
    renderPanel({ project: { ...publicProject, projectScanState: "snapshot_queued" } });
    expect(screen.getByText(/immutable source snapshot is queued/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /snapshot queued/i })).toBeDisabled();
  });

  it("allows a waiting published snapshot to resume once scan runtime becomes available", async () => {
    mocks.resumeScan.mockResolvedValue({
      ok: true,
      status: "scan_queued",
      taskId: "77777777-7777-4777-8777-777777777777",
      scanJobId: "88888888-8888-4888-8888-888888888888",
      replayed: false,
      message: "ScopeForge resumed the published snapshot and queued its repository scan.",
    });
    renderPanel({
      project: { ...publicProject, projectScanState: "waiting_scan_runtime" },
      snapshotRuntimeAvailable: false,
      scanRuntimeAvailable: true,
    });

    const button = screen.getByRole("button", { name: /resume project scan/i });
    expect(button).toBeEnabled();
    fireEvent.click(button);

    await waitFor(() => expect(mocks.resumeScan).toHaveBeenCalledWith("22222222-2222-4222-8222-222222222222"));
    expect(mocks.requestScan).not.toHaveBeenCalled();
    expect(await screen.findByText(/resumed the published snapshot/i)).toBeInTheDocument();
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("allows a private waiting snapshot to use the same exact-snapshot recovery path", () => {
    renderPanel({
      project: { ...publicProject, isPrivate: true, projectScanState: "waiting_scan_runtime" },
      privateSnapshotRuntimeAvailable: false,
      scanRuntimeAvailable: true,
    });
    expect(screen.getByRole("button", { name: /resume project scan/i })).toBeEnabled();
  });

  it("keeps waiting recovery disabled until the repository scan runtime is available", () => {
    renderPanel({ project: { ...publicProject, projectScanState: "waiting_scan_runtime" } });
    expect(screen.getByRole("button", { name: /waiting for scan runtime/i })).toBeDisabled();
  });

  it("allows retry-pending continuation to use the same bounded recovery action", () => {
    renderPanel({
      project: { ...publicProject, projectScanState: "retry_pending" },
      scanRuntimeAvailable: true,
    });
    expect(screen.getByRole("button", { name: /resume project scan/i })).toBeEnabled();
  });

  it("keeps ordinary workspace members read-only", () => {
    renderPanel({ role: "member" });
    expect(screen.getByText(/elevated workspace access/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /owner or admin required/i })).toBeDisabled();
  });

  it("shows the bounded server result and refreshes after a queued scan", async () => {
    mocks.requestScan.mockResolvedValue({
      ok: true,
      status: "snapshot_queued",
      taskId: "66666666-6666-4666-8666-666666666666",
      message: "ScopeForge queued an immutable source snapshot.",
    });
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: /^scan project$/i }));

    await waitFor(() => expect(mocks.requestScan).toHaveBeenCalledTimes(1));
    expect(mocks.requestScan).toHaveBeenCalledWith("22222222-2222-4222-8222-222222222222");
    expect(await screen.findByText("ScopeForge queued an immutable source snapshot.")).toBeInTheDocument();
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });
});
