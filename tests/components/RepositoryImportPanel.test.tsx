import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import RepositoryImportPanel from "@/components/assets/RepositoryImportPanel";
import { PHASE3_IMPORT_MAX_BODY_BYTES } from "@/lib/phase3-import/transport";

const history = [
  {
    id: "import-1",
    scanJobId: "job-1",
    runRef: `sfh1:${"a".repeat(64)}`,
    toolVersion: "0.1.0",
    scanStartedAt: "2026-08-26T00:00:00.000Z",
    scanDurationMs: 125,
    scannerErrorCount: 0,
    filesAnalyzed: 12,
    findingCount: 3,
    createdAt: "2026-08-26T00:00:01.000Z",
  },
];

function renderPanel() {
  return render(
    <RepositoryImportPanel
      assetId="asset-1"
      repositoryUrl="https://github.com/acme/example"
      history={history}
    />,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("RepositoryImportPanel", () => {
  it("shows the privacy-reduced export command, disclosure, history and canonical findings link", () => {
    renderPanel();

    expect(screen.getByText(
      "scopeforge scan . --format hosted-json --repository https://github.com/acme/example --output scopeforge-hosted.json",
    )).toBeInTheDocument();
    expect(screen.getByText(/source snippets/i)).toBeInTheDocument();
    expect(screen.getByText(/secret values/i)).toBeInTheDocument();
    expect(screen.getByText(/3 findings/i)).toBeInTheDocument();
    expect(screen.getByText(/12 files analyzed/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view canonical findings/i })).toHaveAttribute("href", "/dashboard/findings");
  });

  it("rejects an oversized file locally before making an HTTP request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderPanel();

    const file = new File(
      [new Uint8Array(PHASE3_IMPORT_MAX_BODY_BYTES + 1)],
      "scopeforge-hosted.json",
      { type: "application/json" },
    );
    fireEvent.change(screen.getByLabelText(/hosted json file/i), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: /import hosted findings/i }));

    expect(await screen.findByText(/exceeds the 3.5 mb import boundary/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uploads the selected file as raw application/json to the asset-scoped endpoint", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      data: { importRunId: "import-2", scanJobId: "job-2", replayed: false },
    }), {
      status: 201,
      headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    renderPanel();

    const file = new File(["{}"], "scopeforge-hosted.json", { type: "application/json" });
    fireEvent.change(screen.getByLabelText(/hosted json file/i), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: /import hosted findings/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/phase3-import?assetId=asset-1",
      expect.objectContaining({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: file,
      }),
    );
    expect(await screen.findByText(/hosted findings imported successfully/i)).toBeInTheDocument();
  });

  it("shows only the safe route error message returned by the server", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      error: {
        code: "PHASE3_IMPORT_ASSET_MISMATCH",
        message: "The hosted result does not match the selected repository asset.",
      },
    }), {
      status: 400,
      headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    renderPanel();

    const file = new File(["{}"], "scopeforge-hosted.json", { type: "application/json" });
    fireEvent.change(screen.getByLabelText(/hosted json file/i), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: /import hosted findings/i }));

    expect(await screen.findByText(/does not match the selected repository asset/i)).toBeInTheDocument();
  });
});
