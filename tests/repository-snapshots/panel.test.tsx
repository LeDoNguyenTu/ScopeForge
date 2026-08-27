import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RepositorySnapshotPanel from "@/components/assets/RepositorySnapshotPanel";
import { requestRepositorySnapshot } from "@/app/dashboard/assets/[assetId]/snapshot-actions";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock("@/app/dashboard/assets/[assetId]/snapshot-actions", () => ({
  requestRepositorySnapshot: vi.fn(),
}));

const history = [{
  id: "snapshot-1",
  scanJobId: "job-1",
  defaultBranch: "main",
  resolvedCommitSha: "a".repeat(40),
  retainedFileCount: 12,
  retainedBytes: 4096,
  storedArtifactBytes: 2048,
  createdAt: "2026-08-27T03:00:00.000Z",
  expiresAt: "2026-09-03T03:00:00.000Z",
}];

beforeEach(() => {
  refresh.mockReset();
  vi.mocked(requestRepositorySnapshot).mockReset();
});

describe("RepositorySnapshotPanel", () => {
  it("shows owner/admin request controls and safe provenance without download authority", () => {
    render(<RepositorySnapshotPanel assetId="asset-1" role="owner" history={history} />);

    expect(screen.getByRole("button", { name: /create private source snapshot/i })).toBeInTheDocument();
    expect(screen.getByText(/current public github default branch/i)).toBeInTheDocument();
    expect(screen.getByText(/does not run package scripts/i)).toBeInTheDocument();
    expect(screen.getByText(/phase 6c/i)).toBeInTheDocument();
    expect(screen.getByText(/aaaaaaaaaaaa on main/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /download/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/branch|ref|sha|url|budget/i)).not.toBeInTheDocument();
  });

  it("keeps member/viewer history read-only", () => {
    render(<RepositorySnapshotPanel assetId="asset-1" role="viewer" history={history} />);
    expect(screen.queryByRole("button", { name: /create private source snapshot/i })).not.toBeInTheDocument();
    expect(screen.getByText(/read-only/i)).toBeInTheDocument();
    expect(screen.getByText(/aaaaaaaaaaaa on main/i)).toBeInTheDocument();
  });

  it("requests by asset id only and shows the safe result", async () => {
    vi.mocked(requestRepositorySnapshot).mockResolvedValue({
      ok: true,
      data: { taskId: "task-1" },
    });
    render(<RepositorySnapshotPanel assetId="asset-1" role="admin" history={[]} />);

    fireEvent.click(screen.getByRole("button", { name: /create private source snapshot/i }));
    await waitFor(() => expect(requestRepositorySnapshot).toHaveBeenCalledWith("asset-1"));
    expect(await screen.findByText(/snapshot request queued/i)).toBeInTheDocument();
  });
});