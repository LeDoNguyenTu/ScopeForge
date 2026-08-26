# Phase 6B Repository Acquisition and Private Input Artifacts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a narrowly scoped hosted path that acquires the current default-branch contents of an existing public GitHub repository asset, normalizes the hostile archive into a deterministic private source snapshot, and retains safe immutable provenance without running scanners or creating findings.

**Architecture:** Extend the Phase 6A worker queue with one closed execution class, `repository_snapshot_github_public_v1`. The control plane derives repository identity from the stored asset, PostgreSQL remains authoritative for job/task/attempt/cancellation state, the trusted server composes a short-lived attempt-specific R2 PUT authorization, and the isolated executor uses a dedicated GitHub-only transport plus an in-process hostile tar/gzip normalizer. Successful publication occurs only after the trusted server verifies the uploaded object exists at the server-derived key with the exact reported size and a dedicated database RPC atomically publishes immutable snapshot metadata with the active lease.

**Tech Stack:** TypeScript 5.8, Node.js 22 built-ins (`crypto`, `dns`, `https`, `tls`, `zlib`, streams), Next.js 15 App Router/server actions, Supabase/PostgreSQL 17, R2 S3-compatible signed requests implemented in server-only TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-27-phase-6b-repository-acquisition-design.md`

## Global Constraints

- GitHub Actions monthly allowance is exhausted. Do not trigger, rerun, or depend on GitHub Actions. Every commit in this plan uses `[skip ci]`.
- Phase 6B supports only existing repository assets canonicalized as `https://github.com/<owner>/<repository>`.
- Browser callers cannot provide repository URLs, branches, refs, SHAs, headers, credentials, proxies, commands, environment variables, clone flags, package-manager settings, network policy, execution class, or resource budgets.
- Do not run Phase 3 scanners or create findings in Phase 6B.
- Do not invoke `git`, `tar`, `unzip`, shell commands, package managers, repository code, submodules, or Git LFS secondary fetches.
- New execution class: `repository_snapshot_github_public_v1`.
- New network policy: `github_public_archive_and_attempt_artifact_put_v1`.
- Attempt limits: 300,000 ms wall time, 120,000 ms CPU time, 536,870,912 bytes memory, 1 process, 536,870,912 bytes scratch, 65,536 bytes terminal output.
- Task absolute lifetime: 1,200,000 ms from enqueue.
- Archive limits: 128 MiB compressed, 512 MiB expanded regular-file bytes consumed, 50,000 entries inspected, 20,000 retained files, 2 MiB per retained file, 256 MiB retained bytes, 1,024 UTF-8 bytes per normalized path, 320 MiB normalized artifact bytes.
- Snapshot artifact format is `scopeforge-repository-snapshot-v1`: deterministic gzip-compressed POSIX tar with `.scopeforge/snapshot-manifest-v1.json`.
- Ready snapshot metadata is immutable; private artifacts expire after 7 days.
- Only owner/admin may request a hosted repository snapshot.
- Request limits: one active repository-snapshot job per workspace, same-asset cooldown of 5 minutes, maximum 20 requests per workspace per UTC day.
- Private worker/artifact tables must remain inaccessible to browser roles; public snapshot metadata is member SELECT-only through RLS.
- Every public trusted mutation RPC is `SECURITY DEFINER`, `SET search_path = ''`, revoked from `PUBLIC`, `anon`, and `authenticated`, and granted only to `service_role`.
- Phase 6A `foundation_no_egress_v1` remains zero-egress and behaviorally unchanged.
- Phase 5C hosted import remains non-executing.

---

### Task 1: Extend the closed worker contracts for repository snapshots

**Files:**
- Modify: `packages/worker-contracts/types.ts`
- Modify: `packages/worker-contracts/profiles.ts`
- Modify: `packages/worker-contracts/validation.ts`
- Modify: `packages/worker-contracts/index.ts`
- Create: `tests/workers/repository-snapshot-contracts.test.ts`
- Modify: `tests/workers/contracts.test.ts`

**Interfaces:**
- Consumes: existing Phase 6A `WorkerTaskContract`, `WorkerTerminalEnvelope`, `workerExecutionProfile()`, and strict validation helpers.
- Produces:
  - `WorkerExecutionClass = "foundation_no_egress_v1" | "repository_snapshot_github_public_v1"`
  - `WorkerNetworkPolicy = "none" | "github_public_archive_and_attempt_artifact_put_v1"`
  - `RepositorySnapshotInput`
  - `RepositorySnapshotUploadDescriptor`
  - `RepositorySnapshotResult`
  - `RepositorySnapshotSkipCounts`
  - a discriminated union for worker task input/result
  - strict validators that never accept caller-selected authority fields.

- [ ] **Step 1: Write the failing contract tests**

Add tests that pin the second profile and exact task/result shapes:

```ts
import { describe, expect, it } from "vitest";
import {
  validateWorkerTaskContract,
  validateWorkerTerminalEnvelope,
  workerExecutionProfile,
} from "@/packages/worker-contracts";

describe("repository snapshot worker contract", () => {
  it("pins the repository snapshot execution profile", () => {
    expect(workerExecutionProfile("repository_snapshot_github_public_v1")).toEqual({
      executionClass: "repository_snapshot_github_public_v1",
      networkPolicy: "github_public_archive_and_attempt_artifact_put_v1",
      budget: {
        maxWallTimeMs: 300_000,
        maxCpuTimeMs: 120_000,
        maxMemoryBytes: 536_870_912,
        maxProcesses: 1,
        maxInputFiles: 20_000,
        maxInputBytes: 268_435_456,
        maxScratchBytes: 536_870_912,
        maxOutputBytes: 65_536,
      },
    });
  });

  it("rejects extra authority in repository snapshot input", () => {
    expect(() => validateWorkerTaskContract({
      taskId: "11111111-1111-4111-8111-111111111111",
      attemptId: "22222222-2222-4222-8222-222222222222",
      executionClass: "repository_snapshot_github_public_v1",
      leaseToken: "a".repeat(64),
      absoluteDeadlineAt: "2026-08-27T00:20:00.000Z",
      budget: workerExecutionProfile("repository_snapshot_github_public_v1").budget,
      input: {
        kind: "repository_snapshot_github_public",
        owner: "openai",
        repository: "openai-node",
        canonicalRepositoryUrl: "https://github.com/openai/openai-node",
        artifactUpload: {
          method: "PUT",
          url: "https://example.r2.cloudflarestorage.com/object?X-Amz-Signature=abc",
          expiresAt: "2026-08-27T00:06:00.000Z",
        },
        command: "git clone",
      },
    })).toThrow("WORKER_TASK_INVALID");
  });
});
```

- [ ] **Step 2: Record the RED checkpoint**

Run when a dependency-complete local checkout is available:

```bash
npx vitest run tests/workers/contracts.test.ts tests/workers/repository-snapshot-contracts.test.ts
```

Expected before implementation: failure because the repository snapshot class/input/result are unknown. While the no-Actions environment cannot execute the suite, preserve this RED test commit explicitly.

- [ ] **Step 3: Add the exact TypeScript contracts**

Use closed discriminated types:

```ts
export type WorkerExecutionClass =
  | "foundation_no_egress_v1"
  | "repository_snapshot_github_public_v1";

export type WorkerNetworkPolicy =
  | "none"
  | "github_public_archive_and_attempt_artifact_put_v1";

export interface RepositorySnapshotUploadDescriptor {
  method: "PUT";
  url: string;
  expiresAt: string;
}

export interface RepositorySnapshotInput {
  kind: "repository_snapshot_github_public";
  owner: string;
  repository: string;
  canonicalRepositoryUrl: string;
  artifactUpload: RepositorySnapshotUploadDescriptor;
}

export interface RepositorySnapshotSkipCounts {
  symlink: number;
  hardlink: number;
  fileTooLarge: number;
  retainedFileLimit: number;
  retainedBytesLimit: number;
}

export interface RepositorySnapshotResult {
  kind: "repository_snapshot_github_public";
  canonicalRepositoryUrl: string;
  defaultBranch: string;
  resolvedCommitSha: string;
  contentDigest: string;
  artifactDigest: string;
  compressedBytes: number;
  expandedBytes: number;
  retainedFileCount: number;
  retainedBytes: number;
  storedArtifactBytes: number;
  skipCounts: RepositorySnapshotSkipCounts;
}
```

Make `WorkerTaskContract.input` a `FoundationProbeInput | RepositorySnapshotInput` union and `WorkerTerminalEnvelope.result` a `FoundationProbeResult | RepositorySnapshotResult | null` union. Extend the closed failure-code union with:

```ts
| "REPOSITORY_UNAVAILABLE"
| "REPOSITORY_IDENTITY_CHANGED"
| "REPOSITORY_NETWORK_POLICY_FAILED"
| "REPOSITORY_ARCHIVE_UNSAFE"
| "REPOSITORY_ARCHIVE_BUDGET_EXCEEDED"
| "REPOSITORY_ARTIFACT_UPLOAD_FAILED";
```

- [ ] **Step 4: Add the exact profile**

```ts
const REPOSITORY_SNAPSHOT_GITHUB_PUBLIC_V1: WorkerExecutionProfile = Object.freeze({
  executionClass: "repository_snapshot_github_public_v1",
  networkPolicy: "github_public_archive_and_attempt_artifact_put_v1",
  budget: Object.freeze({
    maxWallTimeMs: 300_000,
    maxCpuTimeMs: 120_000,
    maxMemoryBytes: 536_870_912,
    maxProcesses: 1,
    maxInputFiles: 20_000,
    maxInputBytes: 268_435_456,
    maxScratchBytes: 536_870_912,
    maxOutputBytes: 65_536,
  }),
});
```

Update the exhaustive switch in `workerExecutionProfile()`.

- [ ] **Step 5: Extend strict validation**

The repository input validator must accept exactly `kind`, `owner`, `repository`, `canonicalRepositoryUrl`, and `artifactUpload`. Pin owner/repository to non-empty GitHub path components, canonical URL to `https://github.com/${owner}/${repository}`, upload method to `PUT`, HTTPS only, a bounded URL length, and an ISO expiry no later than the task deadline. The terminal validator must enforce 40 lowercase hex commit SHA, 64 lowercase hex digests, default branch <= 255 UTF-8 bytes, exact non-negative bounded metrics/counts, and the five exact skip-count keys.

- [ ] **Step 6: Commit the GREEN contract implementation**

```bash
git add packages/worker-contracts tests/workers

git commit -m "feat: add Phase 6B worker contracts [skip ci]"
```

---

### Task 2: Add repository-snapshot job, safe metadata, and private acquisition schema

**Files:**
- Create: `supabase/migrations/20260827010000_phase_6b_repository_snapshot_enum.sql`
- Create: `supabase/migrations/20260827010100_phase_6b_repository_snapshot_schema.sql`
- Create: `tests/repository-snapshots/migration.test.ts`
- Modify: `tests/workers/job-contract.test.ts`

**Interfaces:**
- Consumes: Phase 6A `private.worker_nodes`, `private.worker_tasks`, `private.worker_attempts`, canonical `scan_jobs`, `assets`, `workspace_members`.
- Produces:
  - `scan_job_kind = repository_snapshot`
  - public immutable `repository_source_snapshots`
  - private `repository_snapshot_tasks`
  - private `repository_snapshot_attempt_uploads`
  - private `repository_source_artifacts`
  - execution-class constraints allowing only the two reviewed classes.

- [ ] **Step 1: Write migration contract tests**

Assert the SQL contains:

```ts
expect(enumSql).toContain("alter type public.scan_job_kind add value if not exists 'repository_snapshot'");
expect(schemaSql).toContain("create table public.repository_source_snapshots");
expect(schemaSql).toContain("create table private.repository_snapshot_tasks");
expect(schemaSql).toContain("create table private.repository_snapshot_attempt_uploads");
expect(schemaSql).toContain("create table private.repository_source_artifacts");
expect(schemaSql).toContain("enable row level security");
expect(schemaSql).toContain("repository_snapshot_github_public_v1");
expect(schemaSql).not.toMatch(/grant\s+(insert|update|delete).*repository_source_snapshots.*authenticated/is);
```

Also assert private tables receive no `anon`, `authenticated`, or direct `service_role` DML grants.

- [ ] **Step 2: Record RED**

```bash
npx vitest run tests/repository-snapshots/migration.test.ts tests/workers/job-contract.test.ts
```

Expected before implementation: missing Phase 6B migrations and job kind.

- [ ] **Step 3: Add the enum-only migration**

```sql
alter type public.scan_job_kind
  add value if not exists 'repository_snapshot';
```

Keep this separate because PostgreSQL enum additions must commit before dependent objects are created.

- [ ] **Step 4: Add safe public snapshot metadata**

Create `public.repository_source_snapshots` with composite workspace/asset/job foreign keys, unique `scan_job_id`, `source_kind` fixed to `github_public_archive`, `schema_version = 1`, canonical URL/default branch/40-hex SHA/digests, bounded counts, `skip_counts jsonb`, `created_at`, and `expires_at`. Add a CHECK requiring `expires_at = created_at + interval '7 days'` within timestamp precision used by the RPC.

RLS policy:

```sql
create policy repository_source_snapshots_member_select
on public.repository_source_snapshots
for select
to authenticated
using (public.is_workspace_member(workspace_id));
```

Grant only SELECT to `authenticated`; revoke browser mutations.

- [ ] **Step 5: Add private acquisition/artifact tables**

`private.repository_snapshot_tasks` is one-to-one with worker task and stores server-derived canonical URL, owner, repository, requester, and schema version. `private.repository_snapshot_attempt_uploads` is one-to-one with worker attempt and stores a random opaque object key generated when the attempt is claimed. `private.repository_source_artifacts` is one-to-one with published snapshot ID and stores provider `r2`, opaque object key, stored byte count, artifact digest, expiry, and deletion state.

All private tables get explicit revokes from `PUBLIC`, `anon`, `authenticated`, and direct `service_role` table DML.

- [ ] **Step 6: Add immutable/provenance constraints and covering indexes**

Pin public snapshot rows immutable with BEFORE UPDATE/DELETE triggers. Add covering indexes for every Phase 6B foreign key and operational indexes on `(workspace_id, asset_id, created_at desc)` and private artifact expiry/deletion state.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations tests/repository-snapshots tests/workers/job-contract.test.ts

git commit -m "feat: add Phase 6B snapshot schema [skip ci]"
```

---

### Task 3: Add atomic enqueue, claim enrichment, and publication RPC authority

**Files:**
- Create: `supabase/migrations/20260827010200_phase_6b_repository_snapshot_control.sql`
- Create: `supabase/migrations/20260827010300_phase_6b_repository_snapshot_publication.sql`
- Create: `tests/repository-snapshots/control-migration.test.ts`
- Modify: `tests/workers/migration.test.ts`
- Modify: `tests/workers/private-helper-privileges.test.ts`

**Interfaces:**
- Produces:
  - `enqueue_repository_snapshot_worker_task(target_workspace_id uuid, target_asset_id uuid, target_actor_id uuid) returns jsonb`
  - enriched `claim_worker_task(target_worker_id uuid)` result for repository snapshot tasks, including a server-only `artifactObjectKey` that is stripped before the worker response is returned
  - `get_repository_snapshot_attempt_artifact(target_worker_id uuid, target_task_id uuid, target_attempt_id uuid, target_lease_token text) returns jsonb`
  - `finalize_repository_snapshot_worker_attempt(...) returns jsonb`
  - `list_repository_source_snapshots(target_workspace_id uuid, target_asset_id uuid, target_limit integer default 20) returns setof public.repository_source_snapshots` only if a server-side read RPC is needed; prefer RLS SELECT in application code otherwise.

- [ ] **Step 1: Write RED SQL authority tests**

Pin owner/admin authorization, repository-kind binding, 5-minute same-asset cooldown, 20/day workspace cap, 20-minute absolute task deadline, one active repository snapshot job per workspace, service-role-only RPC execution, and empty search path.

```ts
expect(sql).toContain("REPOSITORY_SNAPSHOT_ACCESS_DENIED");
expect(sql).toContain("REPOSITORY_SNAPSHOT_COOLDOWN");
expect(sql).toContain("REPOSITORY_SNAPSHOT_DAILY_LIMIT");
expect(sql).toContain("interval '20 minutes'");
expect(sql).toContain("set search_path = ''");
expect(sql).toMatch(/revoke execute on function public\.enqueue_repository_snapshot_worker_task[\s\S]*from public, anon, authenticated/i);
```

- [ ] **Step 2: Implement enqueue as one transaction**

The RPC must lock the workspace/asset as needed, verify actor role in `('owner','admin')`, verify asset kind/repository canonical target, query `scan_jobs` for cooldown/daily/active-job limits, create canonical `scan_jobs(job_kind='repository_snapshot', status='queued')`, create `private.worker_tasks(execution_class='repository_snapshot_github_public_v1', absolute_deadline_at=now()+20m, fixed budget/input marker)`, and create the private repository snapshot task row.

It must not accept a URL, branch, ref, commit, worker, execution class, network policy, or budget argument.

- [ ] **Step 3: Enrich claim atomically**

When `claim_worker_task` claims `repository_snapshot_github_public_v1`, create exactly one attempt upload row using:

```sql
encode(extensions.gen_random_bytes(32), 'hex')
```

Return that opaque key fragment only to the trusted service-role server along with the derived owner/repository/canonical URL. The public worker response must never expose raw database credentials or private table identifiers other than the final presigned object URL.

- [ ] **Step 4: Add publication RPC**

`finalize_repository_snapshot_worker_attempt` receives exact worker/task/attempt/lease identity plus the bounded terminal provenance and the server-observed object byte count. It must:

1. lock task/attempt/job rows,
2. reject stale lease or worker,
3. let cancellation win,
4. verify class/job/workspace/asset/requester binding,
5. require server-observed object size to equal reported `stored_artifact_bytes`,
6. validate URL, branch, commit, digests, counts and skip-count keys,
7. create immutable public snapshot metadata,
8. create private artifact locator from the pre-bound attempt object key,
9. finalize attempt/task/job atomically,
10. support exact replay and reject conflicting replay.

- [ ] **Step 5: Harden helper privileges**

Any private helper used by these public RPCs must have EXECUTE revoked from `PUBLIC`, `anon`, `authenticated`, and `service_role`, matching the Phase 6A private-helper model. Only the intended public façade functions receive `service_role` execute.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations tests/repository-snapshots tests/workers

git commit -m "feat: add Phase 6B queue authority [skip ci]"
```

---

### Task 4: Add server-only R2 signing, HEAD verification, and deletion without new dependencies

**Files:**
- Create: `lib/repository-snapshots/object-store.ts`
- Create: `lib/repository-snapshots/r2-signature-v4.ts`
- Create: `lib/repository-snapshots/r2-object-store.ts`
- Create: `lib/repository-snapshots/storage-config.ts`
- Create: `tests/repository-snapshots/r2-signature-v4.test.ts`
- Create: `tests/repository-snapshots/object-store.test.ts`
- Modify: `.env.example`

**Interfaces:**

```ts
export interface RepositorySnapshotObjectStore {
  createAttemptUpload(input: {
    objectKey: string;
    expiresAt: Date;
  }): Promise<{ method: "PUT"; url: string; expiresAt: string }>;

  headObject(objectKey: string): Promise<{ exists: boolean; size: number | null }>;
  deleteObject(objectKey: string): Promise<void>;
}
```

- [ ] **Step 1: Write SigV4 golden-vector tests**

Use fixed credentials/time so signatures are deterministic. Pin canonical URI escaping, sorted query parameters, `host` signed header, `UNSIGNED-PAYLOAD` for presigned PUT, region `auto`, service `s3`, and maximum 360-second presigned duration used by Phase 6B.

- [ ] **Step 2: Record RED**

```bash
npx vitest run tests/repository-snapshots/r2-signature-v4.test.ts tests/repository-snapshots/object-store.test.ts
```

Expected: missing signer/store modules.

- [ ] **Step 3: Implement strict storage config**

Read only server-side variables:

```text
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
```

Reject missing, empty, malformed bucket/account values. Never export credentials to client modules.

- [ ] **Step 4: Implement SigV4 using Node `crypto` only**

Expose narrow internal functions for canonical request creation, HMAC key derivation, presigned PUT URL generation, and signed HEAD/DELETE requests. Do not add generic arbitrary-method signing to public application modules; the object-store adapter chooses the method.

- [ ] **Step 5: Implement the R2 adapter**

`createAttemptUpload()` must require opaque keys matching a closed pattern such as `repository-source/[a-f0-9]{64}.tar.gz`, PUT only, HTTPS R2 endpoint, expiry <= 360 seconds and <= caller-supplied deadline. `headObject()` returns exact `content-length`; `deleteObject()` accepts only the same opaque key shape. Never log full signed URLs.

- [ ] **Step 6: Update `.env.example` comments**

Clarify R2 is private Phase 6B source-artifact storage and credentials are server-only.

- [ ] **Step 7: Commit**

```bash
git add lib/repository-snapshots tests/repository-snapshots .env.example

git commit -m "feat: add private snapshot object storage [skip ci]"
```

---

### Task 5: Build the GitHub-only pinned acquisition transport

**Files:**
- Create: `packages/repository-acquisition-network/types.ts`
- Create: `packages/repository-acquisition-network/policy.ts`
- Create: `packages/repository-acquisition-network/https-stream.ts`
- Create: `packages/repository-acquisition-network/github-client.ts`
- Create: `packages/repository-acquisition-network/index.ts`
- Create: `tests/repository-snapshots/github-network-policy.test.ts`
- Create: `tests/repository-snapshots/github-client.test.ts`
- Create: `tests/repository-snapshots/network-architecture.test.ts`

**Interfaces:**

```ts
export interface GitHubRepositoryResolution {
  canonicalRepositoryUrl: string;
  defaultBranch: string;
  commitSha: string;
}

export interface GitHubArchiveStream {
  response: NodeJS.ReadableStream;
  contentType: string | null;
  contentLength: number | null;
}

export interface GitHubRepositoryAcquirer {
  resolveRepository(owner: string, repository: string, signal: AbortSignal): Promise<GitHubRepositoryResolution>;
  openArchive(owner: string, repository: string, commitSha: string, signal: AbortSignal): Promise<GitHubArchiveStream>;
}
```

- [ ] **Step 1: Write network policy tests**

Pin HTTPS/443 only, no IP-literal inputs, fixed GitHub hosts only, public-address-set validation, pinned socket address, TLS Host/SNI/certificate preservation, no caller headers, manual redirect maximum, and rejection of unexpected redirect hosts/private DNS answers.

- [ ] **Step 2: Record RED**

```bash
npx vitest run tests/repository-snapshots/github-network-policy.test.ts tests/repository-snapshots/github-client.test.ts tests/repository-snapshots/network-architecture.test.ts
```

- [ ] **Step 3: Implement hard-coded URL builders**

Only build these conceptual paths from bounded `owner`, `repository`, default branch and exact commit SHA:

```text
GET https://api.github.com/repos/{owner}/{repository}
GET https://api.github.com/repos/{owner}/{repository}/commits/{encoded-default-branch}
GET https://api.github.com/repos/{owner}/{repository}/tarball/{40-hex-sha}
```

Owner/repository are derived from the stored canonical asset. Default branch is max 255 UTF-8 bytes and is percent-encoded only within the fixed API path. The archive method accepts a 40-hex SHA only.

- [ ] **Step 4: Implement pinned streaming HTTPS**

Reuse `packages/network-safety` address classification and the same DNS/socket-pinning principles as `packages/runtime-network`, but expose only the GitHub-specific methods above. Stream bodies with explicit byte counters/deadlines instead of buffering the archive.

- [ ] **Step 5: Implement exact repository checks**

Metadata must show a public repository whose `html_url` canonical identity matches the stored asset case-insensitively. Reject renamed/transferred identity, private repository, missing/default branch over bounds, malformed commit response, rate-limit failures, and unexpected response schemas with closed error codes.

- [ ] **Step 6: Commit**

```bash
git add packages/repository-acquisition-network tests/repository-snapshots

git commit -m "feat: add GitHub-only acquisition transport [skip ci]"
```

---

### Task 6: Parse hostile GitHub tarballs and build deterministic source bundles

**Files:**
- Create: `packages/repository-snapshot/types.ts`
- Create: `packages/repository-snapshot/path-policy.ts`
- Create: `packages/repository-snapshot/tar-reader.ts`
- Create: `packages/repository-snapshot/manifest.ts`
- Create: `packages/repository-snapshot/tar-writer.ts`
- Create: `packages/repository-snapshot/bundle.ts`
- Create: `packages/repository-snapshot/index.ts`
- Create: `tests/repository-snapshots/path-policy.test.ts`
- Create: `tests/repository-snapshots/tar-reader.test.ts`
- Create: `tests/repository-snapshots/bundle.test.ts`
- Create: `tests/repository-snapshots/archive-hostile.test.ts`

**Interfaces:**

```ts
export interface NormalizedRepositoryFile {
  path: string;
  bytes: Uint8Array;
  size: number;
  sha256: string;
}

export interface RepositorySnapshotBundle {
  bytes: Uint8Array;
  contentDigest: string;
  artifactDigest: string;
  retainedFileCount: number;
  retainedBytes: number;
  storedArtifactBytes: number;
  skipCounts: RepositorySnapshotSkipCounts;
}
```

- [ ] **Step 1: Write hostile path/archive tests**

Cover one GitHub wrapper directory, outside-wrapper entry, multiple wrappers, absolute paths, `..`, NUL, invalid UTF-8, backslash, 1,024-byte boundary, duplicate normalized path, reserved `.scopeforge/snapshot-manifest-v1.json`, symlink/hardlink skip, device/FIFO/socket/unknown-type rejection, malformed checksum/header, and parser byte/entry limits.

- [ ] **Step 2: Write deterministic bundle tests**

Build the same logical retained files from different source metadata/order and assert byte-identical gzip/tar output plus identical content/artifact digests. Assert uid/gid zero, blank owner/group, mtime zero, non-executable file mode, sorted entries, fixed gzip header, and one generated manifest entry.

- [ ] **Step 3: Record RED**

```bash
npx vitest run tests/repository-snapshots/path-policy.test.ts tests/repository-snapshots/tar-reader.test.ts tests/repository-snapshots/bundle.test.ts tests/repository-snapshots/archive-hostile.test.ts
```

- [ ] **Step 4: Implement strict tar parsing**

Implement the minimum POSIX ustar/PAX support required for GitHub tarballs using Node buffers/streams. Validate header checksum, numeric fields and entry size before consuming content. Accept regular files/directories and reviewed local PAX path metadata only. Reject global PAX, sparse files, device/FIFO/socket/unknown entries, invalid numeric encodings, multiple wrapper roots, and unsafe paths. Never materialize symlinks/hardlinks.

- [ ] **Step 5: Apply retention budgets deterministically**

Retain regular files in normalized repository-relative lexical path order for deterministic file-count/byte truncation. Files over 2 MiB increment `fileTooLarge`; after 20,000 retained files or 256 MiB retained bytes, increment the appropriate skip counter while continuing parser safety accounting up to the 50,000-entry/512-MiB safety ceiling.

- [ ] **Step 6: Implement canonical manifest/content digest**

Construct canonical JSON without `contentDigest`, hash its UTF-8 bytes with SHA-256, add the lowercase digest field, then serialize the final manifest canonically. Do not embed artifact digest.

- [ ] **Step 7: Implement deterministic tar+gzip writer**

Use an in-process writer with fixed ustar fields, sorted regular-file entries followed by the reserved generated manifest at a deterministic location/order defined in the package. Fix gzip metadata so repeated builds are byte-identical. Fail if output exceeds 320 MiB before upload.

- [ ] **Step 8: Commit**

```bash
git add packages/repository-snapshot tests/repository-snapshots

git commit -m "feat: add deterministic repository snapshots [skip ci]"
```

---

### Task 7: Compose trusted snapshot request/claim/publication services

**Files:**
- Create: `lib/repository-snapshots/types.ts`
- Create: `lib/repository-snapshots/repository.ts`
- Create: `lib/repository-snapshots/service.ts`
- Create: `lib/repository-snapshots/server-dependencies.ts`
- Modify: `lib/worker-control/types.ts`
- Modify: `lib/worker-control/repository.ts`
- Modify: `lib/worker-control/service.ts`
- Modify: `lib/worker-control/server-dependencies.ts`
- Create: `tests/repository-snapshots/service.test.ts`
- Modify: `tests/workers/repository.test.ts`
- Modify: `tests/workers/service.test.ts`

**Interfaces:**

```ts
export interface RequestRepositorySnapshotInput {
  workspaceId: string;
  assetId: string;
  actorId: string;
}

export interface RequestRepositorySnapshotResult {
  scanJobId: string;
  taskId: string;
  absoluteDeadlineAt: string;
}
```

Worker claim composition must convert the private DB claim into the public worker task by generating the presigned upload URL and deleting `artifactObjectKey` from the returned shape.

- [ ] **Step 1: Write service RED tests**

Cover owner/admin success, member/viewer denial, cross-workspace/non-repository rejection, DB quota code mapping, no caller URL/ref/budget inputs, claim URL signing from server-only object key, no object-key leakage, object HEAD missing/size mismatch before publication, stale/cancel conflict mapping, and exact replay.

- [ ] **Step 2: Implement repository adapter with typed RPC calls only**

Map the new RPCs through `SupabaseClient<Database>.rpc` and parse every JSON response into closed application types. Do not expose raw Supabase errors upward.

- [ ] **Step 3: Implement request service**

The service accepts only trusted `workspaceId`, `assetId`, `actorId` and delegates all authorization/quota checks to the database RPC in addition to the server-side role check used by the action layer.

- [ ] **Step 4: Compose claim-time upload authority**

For repository snapshot claims:

1. parse the DB-derived repository identity and private `artifactObjectKey`,
2. compute upload expiry = min(task absolute deadline, claim time + 6 minutes),
3. call `objectStore.createAttemptUpload`,
4. return `RepositorySnapshotInput` with the presigned descriptor,
5. never return/log `artifactObjectKey` separately.

Foundation probe claim behavior remains unchanged.

- [ ] **Step 5: Compose publication**

Before calling the dedicated publication RPC, load the active attempt artifact key through the lease-bound RPC, call `objectStore.headObject`, require exact reported `storedArtifactBytes` and <= 320 MiB, then call `finalize_repository_snapshot_worker_attempt` with the server-observed size. Missing/oversized/mismatched object fails closed without marking the job succeeded.

- [ ] **Step 6: Commit**

```bash
git add lib/repository-snapshots lib/worker-control tests/repository-snapshots tests/workers

git commit -m "feat: add trusted snapshot services [skip ci]"
```

---

### Task 8: Implement the repository acquisition executor and supervisor dispatch

**Files:**
- Create: `packages/worker-supervisor/repository-snapshot.ts`
- Modify: `packages/worker-supervisor/executor.ts`
- Modify: `packages/worker-supervisor/supervisor.ts`
- Modify: `packages/worker-supervisor/index.ts`
- Create: `tests/repository-snapshots/executor.test.ts`
- Modify: `tests/workers/supervisor.test.ts`
- Create: `tests/repository-snapshots/executor-architecture.test.ts`

**Interfaces:**

```ts
export interface RepositorySnapshotExecutorDependencies {
  github: GitHubRepositoryAcquirer;
  upload: (descriptor: RepositorySnapshotUploadDescriptor, bytes: Uint8Array, signal: AbortSignal) => Promise<void>;
  now?: () => number;
}

export function createRepositorySnapshotExecutor(
  dependencies: RepositorySnapshotExecutorDependencies,
): WorkerExecutor;
```

- [ ] **Step 1: Write executor RED tests**

Cover exact stored identity, metadata/default-branch resolution, immutable commit acquisition, GitHub wrapper removal, bundle generation, PUT with zero redirects, successful terminal provenance, each closed failure code, cancellation during metadata/download/parse/upload, output-size bounds, and no presigned URL in terminal result.

- [ ] **Step 2: Implement orchestration**

The executor sequence is exactly:

```text
validate closed contract
-> resolve exact public repository/default branch/commit
-> open archive pinned to commit SHA
-> parse hostile gzip/tar under safety budgets
-> build deterministic snapshot bundle
-> PUT exact bundle bytes to claim-provided attempt URL
-> return bounded terminal result
```

No repository file is executed or interpreted as acquisition configuration.

- [ ] **Step 3: Keep resource/cancellation authority outside repository logic**

The existing supervisor hard wall-time remains authoritative. The executor uses the supplied AbortSignal for every network/stream/upload operation. It cannot receive lease token or worker broker credential.

- [ ] **Step 4: Dispatch by execution class**

Modify supervisor composition so `foundation_no_egress_v1` continues using the deterministic foundation executor and `repository_snapshot_github_public_v1` uses the new repository snapshot executor. Preserve the existing generic `WorkerExecutor` interface and terminal validation.

- [ ] **Step 5: Add architecture guards**

Assert `worker-supervisor` does not import Supabase/service-role code, repository snapshot executor does not import `child_process`, package managers, scanner coordinator, runtime observer/validator, model providers, or arbitrary browser/application request modules.

- [ ] **Step 6: Commit**

```bash
git add packages/worker-supervisor tests/repository-snapshots tests/workers/supervisor.test.ts

git commit -m "feat: add repository snapshot executor [skip ci]"
```

---

### Task 9: Extend broker transport without widening worker authority

**Files:**
- Modify: `app/api/internal/workers/claim/route.ts`
- Modify: `app/api/internal/workers/finalize/route.ts`
- Modify: `lib/worker-control/transport.ts`
- Modify: `lib/worker-control/http-response.ts`
- Modify: `tests/workers/broker-routes.test.ts`
- Create: `tests/repository-snapshots/broker.test.ts`

**Interfaces:**
- Claim remains body-free and worker-authenticated.
- Heartbeat remains unchanged.
- Finalize remains strict JSON <= 64 KiB and validates one of the closed terminal envelope variants.

- [ ] **Step 1: Write broker RED tests**

Pin body-free claim, repository snapshot claim response with only closed input + presigned URL, no private object key, no user-session fallback, strict terminal JSON, rejection of repository file lists/object keys/upload URLs/arbitrary headers in finalize input, and safe error mapping.

- [ ] **Step 2: Keep claim request authority unchanged**

The worker sends no execution class, URL, repository, or body. Worker identity/class still come from bearer authentication plus the DB worker record.

- [ ] **Step 3: Dispatch finalize by validated result kind**

Foundation probe continues using the Phase 6A finalization path. Repository snapshot success uses the object HEAD + dedicated publication path. Failed/cancelled repository attempts use the existing worker attempt finalization semantics without creating snapshot metadata.

- [ ] **Step 4: Commit**

```bash
git add app/api/internal/workers lib/worker-control tests/workers tests/repository-snapshots/broker.test.ts

git commit -m "feat: extend worker broker for snapshots [skip ci]"
```

---

### Task 10: Add owner/admin repository snapshot UX and bounded history

**Files:**
- Create: `components/assets/RepositorySnapshotPanel.tsx`
- Modify: `app/dashboard/assets/[assetId]/page.tsx`
- Create: `app/dashboard/assets/[assetId]/snapshot-actions.ts`
- Create: `lib/repository-snapshots/read-model.ts`
- Create: `tests/repository-snapshots/panel.test.tsx`
- Create: `tests/repository-snapshots/action.test.ts`
- Create: `tests/repository-snapshots/read-model.test.ts`

**Interfaces:**
- `requestRepositorySnapshot(assetId: string)` derives user/workspace/role from the authenticated server session and passes only trusted IDs to the service.
- `listRepositorySnapshots(supabase, workspaceId, assetId, limit = 20)` uses RLS-scoped safe metadata only.

- [ ] **Step 1: Write RED UI/action tests**

Cover repository-only rendering, owner/admin request button, member/viewer read-only history, no custom URL/ref/SHA/budget fields, request success/error states, 20-row history bound, commit SHA display, expiry status, and no artifact download URL/button.

- [ ] **Step 2: Implement action boundary**

Resolve the selected asset's workspace membership instead of taking the first membership. Require owner/admin. Pass only `workspaceId`, `assetId`, `actorId` to `requestRepositorySnapshot()`.

- [ ] **Step 3: Implement bounded read model**

Select only public safe fields from `repository_source_snapshots`, filter exact workspace/asset, order `created_at desc`, and cap at 20.

- [ ] **Step 4: Implement panel**

Explain that ScopeForge acquires the current public GitHub default branch, stores a private 7-day source snapshot, does not run package scripts, and that scanning is a separate Phase 6C boundary. Show status/provenance only; no raw source/download control.

- [ ] **Step 5: Commit**

```bash
git add components/assets app/dashboard/assets lib/repository-snapshots tests/repository-snapshots

git commit -m "feat: add repository snapshot UX [skip ci]"
```

---

### Task 11: Add artifact retention cleanup and orphan recovery

**Files:**
- Create: `lib/repository-snapshots/cleanup.ts`
- Create: `lib/repository-snapshots/cleanup-repository.ts`
- Create: `tests/repository-snapshots/cleanup.test.ts`
- Create: `supabase/migrations/20260827010400_phase_6b_repository_snapshot_cleanup.sql`
- Modify: `.env.example` only if an operational cleanup route secret is introduced; prefer callable server operation without a public route in v1.

**Interfaces:**

```ts
export interface RepositorySnapshotCleanupCandidate {
  snapshotId: string | null;
  objectKey: string;
  expiresAt: string;
  reason: "expired" | "orphan";
}

export async function cleanupRepositorySnapshotArtifacts(
  input: { now: Date; limit: number },
  deps: { repository: RepositorySnapshotCleanupRepository; objectStore: RepositorySnapshotObjectStore },
): Promise<{ deleted: number; failed: number }>;
```

- [ ] **Step 1: Write cleanup RED tests**

Cover 7-day ready expiry, stale-attempt orphan after 24 hours, maximum 100 objects per run, delete success marking private state, delete failure remaining retryable, idempotent repeated cleanup, no public snapshot provenance mutation, and no browser-accessible cleanup endpoint.

- [ ] **Step 2: Add service-role-only cleanup candidate/mark RPCs**

Return only bounded private candidate metadata to the trusted server. Mark deletion only after object-store DELETE succeeds. Keep helper functions private/unexecutable directly.

- [ ] **Step 3: Implement bounded cleanup service**

Delete at most 100 per run. Continue after individual object failures while returning safe counts. Never include object keys or signed URLs in logs/errors returned to browsers.

- [ ] **Step 4: Commit**

```bash
git add lib/repository-snapshots tests/repository-snapshots supabase/migrations

git commit -m "feat: add snapshot artifact cleanup [skip ci]"
```

---

### Task 12: Reconcile database types and add permanent architecture guards

**Files:**
- Modify: `lib/database.types.ts`
- Modify: `tests/workers/database-types.test.ts`
- Create: `tests/repository-snapshots/architecture.test.ts`
- Modify: `tests/phase3-import/architecture.test.ts` if required by current test naming
- Modify: `tests/workers/contracts.test.ts`

**Interfaces:**
- Database contract includes `repository_snapshot` and every public Phase 6B RPC/table exposed to application code.
- Private tables remain absent from `Database["public"]["Tables"]`.

- [ ] **Step 1: Write RED database/architecture tests**

Pin new enum/table/RPC signatures and forbid:

```text
child_process
worker_threads inside acquisition executor
package-manager execution
scanner coordinator/inventory execution in acquisition worker
runtime observer/validator imports
model-provider/advisory imports
browser access to object store or worker broker
Phase 5C -> worker execution imports
foundation_no_egress_v1 -> GitHub/R2 network imports
```

- [ ] **Step 2: Reconcile manual types from reviewed SQL**

Add only public `repository_source_snapshots`, `repository_snapshot` enum value, and public trusted RPCs. Do not expose private worker/artifact tables.

- [ ] **Step 3: Remove any generic RPC casts introduced during implementation**

All repository snapshot repository/service calls must compile against `SupabaseClient<Database>.rpc(...)` names/args.

- [ ] **Step 4: Commit**

```bash
git add lib/database.types.ts tests/workers tests/repository-snapshots tests/phase3-import

git commit -m "test: lock Phase 6B authority boundaries [skip ci]"
```

---

### Task 13: Final review, direct production reconciliation, documentation, and exact-head merge

**Files:**
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/PHASES.md`
- Modify: `docs/development/CURRENT_STATE.md`
- Modify: `docs/development/TEST_STATUS.md`
- Modify: `docs/development/NEXT_STEPS.md`
- Modify: `docs/development/SESSION_HANDOFF.md`
- Modify: `docs/superpowers/specs/2026-08-27-phase-6b-repository-acquisition-design.md` status to `approved / implemented` only after acceptance evidence is complete.

**Interfaces:**
- Produces a production-reconciled Phase 6B boundary and advances the next design target to Phase 6C zero-egress snapshot scanner execution.

- [ ] **Step 1: Run every executable local check available without GitHub Actions**

When a dependency-complete checkout is available:

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run typecheck
npm run build:cli
node .scopeforge-build/packages/cli/index.js version
npm run benchmark:scanner
npm run build
```

If the environment still cannot materialize dependencies, explicitly record that limitation and do not call the final head fully test/build green.

- [ ] **Step 2: Perform targeted security diff review**

Review every trust boundary with emphasis on:

```text
asset/workspace/actor binding
GitHub identity and mutable-branch -> immutable-SHA transition
DNS/IP/TLS/redirect policy
archive parser path/type/bomb handling
snapshot determinism and digest definitions
presigned URL secrecy
attempt-specific object keys
stale lease/cancellation races
object HEAD exact-size gate
publication idempotency/conflict behavior
private helper/table privileges
cleanup/orphan deletion
Phase 6A/5C authority isolation
```

Fix every plausible merge-blocking finding before deployment.

- [ ] **Step 3: Deploy migrations in exact repository order to the ScopeForge Supabase project**

Apply only reviewed forward migrations after the branch SQL is final. Never apply to the Job Command Center project.

- [ ] **Step 4: Verify production directly**

Check migration history, RLS, public snapshot SELECT-only policy, zero browser mutation/worker RPC execute authority, service-role public RPC execution, private helper revokes, indexes/constraints, `repository_snapshot` enum, no direct private table grants, and rollback-only request/worker smoke where production data permits.

- [ ] **Step 5: Run Supabase advisors**

Require security advisor clean and no Phase 6B missing-FK-index notices. Add forward hardening migration for any Phase 6B FK/index/privilege issue rather than editing already-applied migration history.

- [ ] **Step 6: Generate live Supabase TypeScript types and compare**

Confirm `repository_snapshot`, `repository_source_snapshots`, and every public Phase 6B RPC match `lib/database.types.ts`. Correct application types before merge.

- [ ] **Step 7: Update permanent docs truthfully**

Record exact reviewed head, migrations, security fixes, advisor state, smoke evidence, and the no-Actions limitation. Mark Phase 6B complete only after production reconciliation.

- [ ] **Step 8: Open/review the PR without invoking Actions**

PR text must explicitly say GitHub Actions are intentionally not used due to the exhausted monthly allowance. Check changed-file inventory and review threads.

- [ ] **Step 9: Merge only the exact reviewed head**

Use expected-head SHA protection. Do not merge if the head moves after review.

- [ ] **Step 10: Post-merge handoff**

Record merge SHA on `main`, keep commits `[skip ci]`, and set exact next task to Phase 6C design: consume immutable private source snapshots in a zero-egress isolated scanner worker, still without package execution or generic network authority.
