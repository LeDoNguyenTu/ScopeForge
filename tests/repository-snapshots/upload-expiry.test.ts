import { afterEach, describe, expect, it, vi } from "vitest";

const { requestMock, statMock } = vi.hoisted(() => ({
  requestMock: vi.fn(),
  statMock: vi.fn(),
}));

vi.mock("node:https", () => ({
  request: requestMock,
}));

vi.mock("node:fs/promises", () => ({
  stat: statMock,
}));

import { uploadRepositorySnapshotArtifact } from "@/packages/repository-snapshot-network/upload";

afterEach(() => {
  vi.restoreAllMocks();
  requestMock.mockReset();
  statMock.mockReset();
});

describe("repository snapshot upload authorization", () => {
  it("rechecks descriptor expiry after async artifact stat before starting the PUT", async () => {
    const expiryMs = 2_000;
    vi.spyOn(Date, "now")
      .mockReturnValueOnce(1_000)
      .mockReturnValue(3_000);
    statMock.mockResolvedValue({
      isFile: () => true,
      size: 7,
    });
    requestMock.mockImplementation(() => {
      throw new Error("NETWORK_SHOULD_NOT_START");
    });

    await expect(uploadRepositorySnapshotArtifact({
      descriptor: {
        method: "PUT",
        url: `https://scopeforge-artifacts.${"a".repeat(32)}.r2.cloudflarestorage.com/repository-source/${"b".repeat(64)}.tar.gz?X-Amz-Signature=attempt-only`,
        expiresAt: new Date(expiryMs).toISOString(),
      },
      artifactPath: "/tmp/repository-snapshot.tar.gz",
      storedArtifactBytes: 7,
      signal: new AbortController().signal,
    })).rejects.toThrow("Repository snapshot upload authorization is expired.");

    expect(statMock).toHaveBeenCalledTimes(1);
    expect(requestMock).not.toHaveBeenCalled();
  });
});
