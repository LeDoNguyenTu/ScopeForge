import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createRepositoryScanArtifactAccess } from "@/lib/repository-scans/artifact-access";
import type { RepositoryScanArtifactRepository } from "@/lib/repository-scans/repository";
import type { RepositorySnapshotObjectStore } from "@/lib/repository-snapshots/object-store";

const TASK_ID = "11111111-1111-4111-8111-111111111111";
const ATTEMPT_ID = "22222222-2222-4222-8222-222222222222";
const WORKER_ID = "33333333-3333-4333-8333-333333333333";
const SNAPSHOT_ID = "44444444-4444-4444-8444-444444444444";
const LEASE_TOKEN = "a".repeat(64);
const OBJECT_KEY = `repository-source/${"b".repeat(64)}.tar.gz`;
const ARTIFACT_DIGEST = "c".repeat(64);
const NOW = new Date("2026-08-27T00:30:00.000Z");

function repository(): RepositoryScanArtifactRepository {
  return {
    async resolveLeaseBoundArtifact(input) {
      expect(input).toEqual({
        workerId: WORKER_ID,
        taskId: TASK_ID,
        attemptId: ATTEMPT_ID,
        leaseToken: LEASE_TOKEN,
      });
      return {
        snapshotId: SNAPSHOT_ID,
        objectKey: OBJECT_KEY,
        storedArtifactBytes: 4096,
        artifactDigest: ARTIFACT_DIGEST,
        leaseExpiresAt: "2026-08-27T00:31:00.000Z",
        artifactExpiresAt: "2026-08-28T00:30:00.000Z",
      };
    },
  };
}

function objectStore(calls: Array<{ objectKey: string; expiresAt: Date }>): RepositorySnapshotObjectStore {
  return {
    async createAttemptUpload() {
      throw new Error("upload authority must not be used by Phase 6C staging");
    },
    async createAttemptDownload(input) {
      calls.push(input);
      return {
        method: "GET",
        url: `https://scopeforge-repository-source.example.invalid/${input.objectKey}?signature=redacted`,
        expiresAt: input.expiresAt.toISOString(),
      };
    },
    async headObject() {
      throw new Error("HEAD is not part of artifact descriptor issuance");
    },
    async deleteObject() {
      throw new Error("DELETE is not part of artifact descriptor issuance");
    },
  };
}

describe("Phase 6C lease-bound artifact access", () => {
  it("caps GET authorization by both the 120-second policy and the active lease", async () => {
    const calls: Array<{ objectKey: string; expiresAt: Date }> = [];
    const result = await createRepositoryScanArtifactAccess({
      workerId: WORKER_ID,
      taskId: TASK_ID,
      attemptId: ATTEMPT_ID,
      leaseToken: LEASE_TOKEN,
    }, {
      repository: repository(),
      objectStore: objectStore(calls),
      now: () => NOW,
    });

    expect(calls).toEqual([{
      objectKey: OBJECT_KEY,
      expiresAt: new Date("2026-08-27T00:31:00.000Z"),
    }]);
    expect(result).toEqual({
      snapshotId: SNAPSHOT_ID,
      storedArtifactBytes: 4096,
      artifactDigest: ARTIFACT_DIGEST,
      download: {
        method: "GET",
        url: `https://scopeforge-repository-source.example.invalid/${OBJECT_KEY}?signature=redacted`,
        expiresAt: "2026-08-27T00:31:00.000Z",
      },
    });
    expect(result).not.toHaveProperty("objectKey");
    expect(JSON.stringify(result)).not.toContain("secretAccessKey");
  });

  it("fails closed when less than one second of exact lease authority remains", async () => {
    const leaseBoundRepository: RepositoryScanArtifactRepository = {
      async resolveLeaseBoundArtifact() {
        return {
          snapshotId: SNAPSHOT_ID,
          objectKey: OBJECT_KEY,
          storedArtifactBytes: 4096,
          artifactDigest: ARTIFACT_DIGEST,
          leaseExpiresAt: "2026-08-27T00:30:00.500Z",
          artifactExpiresAt: "2026-08-28T00:30:00.000Z",
        };
      },
    };

    await expect(createRepositoryScanArtifactAccess({
      workerId: WORKER_ID,
      taskId: TASK_ID,
      attemptId: ATTEMPT_ID,
      leaseToken: LEASE_TOKEN,
    }, {
      repository: leaseBoundRepository,
      objectStore: objectStore([]),
      now: () => NOW,
    })).rejects.toThrow(/authorization/i);
  });

  it("resolves the private object key only through an exact Phase 6C lease RPC", async () => {
    const sql = await readFile(
      path.resolve("supabase/migrations/20260827020300_phase_6c_repository_scan_artifact_access.sql"),
      "utf8",
    );

    expect(sql).toMatch(/create or replace function public\.get_repository_scan_snapshot_artifact\(\s*target_worker_id uuid,\s*target_task_id uuid,\s*target_attempt_id uuid,\s*target_lease_token text\s*\)/i);
    expect(sql).toContain("phase3_repository_scan_no_egress_v1");
    expect(sql).toMatch(/attempt_record\.worker_id <> target_worker_id/i);
    expect(sql).toMatch(/attempt_record\.lease_token_hash <> calculated_hash/i);
    expect(sql).toMatch(/attempt_record\.finished_at is not null/i);
    expect(sql).toMatch(/attempt_record\.lease_expires_at <= access_now/i);
    expect(sql).toMatch(/task_record\.state <> 'leased'/i);
    expect(sql).toMatch(/scan_task\.snapshot_id/i);
    expect(sql).toMatch(/artifact_record\.deletion_status <> 'active'/i);
    expect(sql).toMatch(/artifact_record\.deleted_at is not null/i);
    expect(sql).toMatch(/artifact_record\.expires_at <= access_now/i);
    expect(sql).toMatch(/revoke all on function public\.get_repository_scan_snapshot_artifact\(uuid, uuid, uuid, text\)[\s\S]*from public, anon, authenticated, service_role/i);
    expect(sql).toMatch(/grant execute on function public\.get_repository_scan_snapshot_artifact\(uuid, uuid, uuid, text\)[\s\S]*to service_role/i);
  });
});