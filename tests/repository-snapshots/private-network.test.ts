import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { createPrivateRepositoryArchiveReader } from "@/packages/repository-acquisition-network/private-archive";

const COMMIT = "a".repeat(40);
const LEASE = {
  kind: "github_private_archive_lease_v1" as const,
  canonicalRepositoryUrl: "https://github.com/example-org/private-repo",
  defaultBranch: "main",
  resolvedCommitSha: COMMIT,
  archiveUrl: `https://codeload.github.com/example-org/private-repo/legacy.tar.gz/${COMMIT}?token=temporary-capability`,
  expiresAt: "2026-09-11T00:04:00.000Z",
};

function response(status = 200, headers: Record<string, string | undefined> = {}) {
  return {
    status,
    headers,
    body: Readable.from([Buffer.from("archive")]),
  };
}

describe("Phase 10A2 private repository archive reader", () => {
  it("performs exactly one pinned request to the brokered codeload capability", async () => {
    const request = vi.fn(async (_url: URL, _signal: AbortSignal) => response(200, {
      "content-type": "application/x-gzip",
      "content-length": "7",
    }));
    const reader = createPrivateRepositoryArchiveReader({
      transport: { request },
      now: () => Date.parse("2026-09-11T00:00:00.000Z"),
    });

    const archive = await reader.openArchive(LEASE, new AbortController().signal);
    expect(request).toHaveBeenCalledTimes(1);
    expect(String(request.mock.calls[0][0])).toBe(LEASE.archiveUrl);
    expect(archive).toMatchObject({
      contentType: "application/x-gzip",
      contentLength: 7,
    });
  });

  it("refuses redirect chasing after the brokered codeload capability", async () => {
    const redirectBody = Readable.from([]);
    const request = vi.fn(async () => ({
      status: 302,
      headers: { location: "https://codeload.github.com/example-org/private-repo/other" },
      body: redirectBody,
    }));
    const reader = createPrivateRepositoryArchiveReader({
      transport: { request },
      now: () => Date.parse("2026-09-11T00:00:00.000Z"),
    });

    await expect(reader.openArchive(LEASE, new AbortController().signal)).rejects.toThrow(/status|redirect|archive/i);
    expect(request).toHaveBeenCalledTimes(1);
    expect(redirectBody.destroyed).toBe(true);
  });

  it("rejects expired and identity-mismatched leases before network access", async () => {
    for (const lease of [
      { ...LEASE, expiresAt: "2026-09-10T23:59:59.000Z" },
      { ...LEASE, canonicalRepositoryUrl: "https://github.com/other/private-repo" },
      { ...LEASE, archiveUrl: `https://codeload.github.com/other/private-repo/legacy.tar.gz/${COMMIT}?token=x` },
      { ...LEASE, resolvedCommitSha: "b".repeat(40) },
    ]) {
      const request = vi.fn();
      const reader = createPrivateRepositoryArchiveReader({
        transport: { request },
        now: () => Date.parse("2026-09-11T00:00:00.000Z"),
      });
      await expect(reader.openArchive(lease, new AbortController().signal)).rejects.toThrow();
      expect(request).not.toHaveBeenCalled();
    }
  });

  it("enforces the same compressed archive ceiling as public acquisition", async () => {
    const request = vi.fn(async () => response(200, { "content-length": "134217729" }));
    const reader = createPrivateRepositoryArchiveReader({
      transport: { request },
      now: () => Date.parse("2026-09-11T00:00:00.000Z"),
    });
    await expect(reader.openArchive(LEASE, new AbortController().signal)).rejects.toThrow(/compressed|bound|exceeds/i);
  });
});
