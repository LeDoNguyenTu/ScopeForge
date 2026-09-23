import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RepositorySnapshotPanel from "@/components/assets/RepositorySnapshotPanel";
import { ToastProvider } from "@/components/feedback/ToastProvider";

const mocks = vi.hoisted(() => ({ request: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/app/dashboard/assets/[assetId]/snapshot-actions", () => ({ requestRepositorySnapshot: mocks.request }));

describe("RepositorySnapshotPanel", () => {
  it("reports a queued snapshot as a temporary toast", async () => {
    mocks.request.mockResolvedValue({ ok: true, data: {} });
    render(<ToastProvider><RepositorySnapshotPanel assetId="asset-1" role="owner" history={[]} runtimeAvailable /></ToastProvider>);
    fireEvent.click(screen.getByRole("button", { name: /create private source snapshot/i }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Snapshot request queued."));
    expect(mocks.refresh).toHaveBeenCalledOnce();
    expect(document.querySelector(".verificationPanel > .authMessage[role='status']")).toBeNull();
  });
});
