# Phase 6D Release State

This file is the authoritative release-gate checkpoint for **Phase 6D dedicated network workers** while PR #52 remains open. It supersedes older Phase 6D "before implementation" wording in general development notes until those historical documents are reconciled after the phase closes.

## Candidate

- branch: `feat/phase-6d-network-workers-v1-task14`
- PR: #52
- current reviewed code/security head before this checkpoint update: `0fffafa2ea69a78bd0fe2c4c25546cbf5879a2bf`
- base: `design/phase-6d-network-workers-v1` at `2be96ada2cf511b186d5e994c214e12683e76802`
- PR remains **draft**
- no dependency manifest or lockfile drift exists in the Phase 6D base-to-head diff

## Implemented boundary

Phase 6D is implemented behind two closed execution classes:

- `passive_runtime_observation_v1`
- `active_cors_validation_v1`

The implementation does not expose a generic URL, HTTP, fetch, proxy, arbitrary-header/body, browser, port-scan, or credential-replay worker primitive.

Runtime executor containers remain network-disabled. Network authority is isolated behind the class-aware Unix-socket mediator. The worker supervisor requires a prepared Phase 6D contract and fails closed when preparation or dedicated finalization authority is unavailable; it does not fall back to the generic executor/finalizer for runtime success.

Dashboard actions do not perform runtime networking from Vercel. They call the request service, whose Phase 6D capability check happens before asset loading or queue creation.

The mediator socket boundary is fail-closed:

- the fixed host socket root is rechecked with `lstat` before use
- symlink and non-directory roots are rejected
- the root must be owned by the supervisor process user
- root permissions are reset to `0700`
- if socket permission publication fails after `listen()`, the listening server is closed and the socket is unlinked before the error escapes

The runtime HTTPS boundary remains closed to trusted GET/HTTPS/443 plans only. DNS is resolved fresh for every request, all returned addresses must pass the shared public-address policy, the selected address is pinned through the request lookup callback, and hostname/SNI validation remains bound to the authorized hostname.

## Cancellation hardening

Review of the initial transport cancellation change found a real integration gap: the HTTPS transport accepted an `AbortSignal`, but the normal passive/active mediator paths did not propagate the supervisor signal into that transport. An in-flight request could therefore remain alive until response/timeout even though cancellation was already visible to the supervisor.

That gap is now closed through code head `0fffafa2ea69a78bd0fe2c4c25546cbf5879a2bf`:

- `packages/runtime-network/https-transport.ts` aborts DNS/HTTPS orchestration from a trusted `AbortSignal` and forwards an internal abort controller into the pinned Node HTTPS request
- passive observation carries the signal into its transport and converts a signal-driven `AbortError` into a cancelled result with no completed request increment
- active CORS validation does the same and preserves its 0-or-1 request contract
- mediator passive/active dependencies carry the signal unchanged
- the supervisor supplies the same attempt abort signal used by worker lifecycle cancellation to both mediator classes
- `tests/runtime-workers/inflight-network-cancellation.test.ts` pins both behavioral paths
- the permanent Phase 6D architecture test pins supervisor -> mediator -> observer/validator transport signal propagation so the connection cannot silently regress

The cancellation additions do not expand URL, method, header, body, credential, redirect, DNS, or socket authority. The signal is a trusted dependency, not serialized worker input.

## Capability state

These capabilities remain disabled and must stay disabled through merge:

- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED` - false unless the environment value is exactly `true`; currently absent/disabled
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED` - false unless the environment value is exactly `true`; currently absent/disabled
- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED = false`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED = false`

Turnstile is not wired as active application behavior. The auth UI continues to describe it as planned before public trial access.

## Live Supabase reconciliation

Authoritative ScopeForge project: `tdgpibrepzcvdivztkta`.

The reviewed Phase 6D migration stack is live. Later Task 14 hardening was added only through forward migrations. The repository migration files are:

- `20260831010900_phase_6d_runtime_worker_finalization_recovery_lock.sql`
- `20260831011000_phase_6d_runtime_worker_claim_clock.sql`
- `20260831011100_worker_recovery_clock.sql`
- `20260831011200_phase_6d_atomic_runtime_publication.sql`

The latest atomic-publication migration is recorded live as `phase_6d_atomic_runtime_publication`.

Live verification after the latest DDL confirmed:

- zero enabled runtime worker nodes
- zero active worker tasks
- zero unfinished worker attempts
- zero active Phase 6D scan jobs
- Phase 6D public control functions are `SECURITY DEFINER`
- trusted functions use an empty `search_path`
- runtime control/publication functions are executable by `service_role` only, not `anon`, `authenticated`, or `public`
- private runtime task state has no direct browser/service-role DML escape where RPC-only mutation is required
- generic `finalize_worker_attempt` accepts only its older closed worker classes and rejects Phase 6D classes via `WORKER_CLASS_UNAVAILABLE`
- dedicated runtime finalization resolves cancellation before success and independently requires `cancel_requested_at IS NULL` for a success transition
- successful Phase 6D result persistence and broker finalization occur atomically in class-specific RPCs under the shared recovery serialization lock
- atomic success publication rechecks the live lease with a fresh database wall clock before persistence
- cancellation/replay branches occur before success persistence

No database migration changed in the mediator/socket/runtime-network cancellation hardening after the last live reconciliation, so the prior database verification remains applicable to the current code delta.

The post-DDL Supabase security advisor has no new Phase 6D finding. Its only current warning is the project-level `auth_leaked_password_protection` setting.

## Task 14 software acceptance

Completed static/review gates through code head `0fffafa2ea69a78bd0fe2c4c25546cbf5879a2bf`:

- no `package.json` or lockfile drift relative to the Phase 6D base
- Phase 6D capability parsing is exact-true/fail-closed
- Phase 6B and Phase 6C hosted runtime gates remain false
- Turnstile is not claimed active
- dashboard Phase 6D actions cannot directly invoke the network mediator/runtime executor
- generic worker finalization cannot publish Phase 6D success
- dedicated runtime finalization is cancellation-first
- successful Phase 6D publication is atomic with trusted canonical persistence
- permanent architecture guards pin network ownership, no-generic-network execution classes, sandbox `--network=none`, atomic success publication, and end-to-end abort propagation
- mediator result schemas exact-validate nested observations and reject unknown/raw fields
- mediator request framing and one-shot session consumption bind task, attempt, class, nonce, and expiry
- reviewed supervisor/runtime code does not log prepared targets, mediator secrets, raw terminal payloads, response bodies, authorization material, cookie values, or resolver transcripts
- mediator socket-root ownership and startup-cleanup failures are fail-closed
- runtime network cancellation reaches the in-flight pinned HTTPS request instead of waiting only for post-request polling

Executable evidence currently available:

- the last useful Vercel/Next.js compiler checkpoint was `5a7d3d26eb1bfaae5c38f536b0b9b153aa437a41`
- Next.js compilation and framework lint/type validation completed successfully there
- that build then failed during `/auth/sign-in` prerender because the **Preview** environment did not contain the public Supabase URL/publishable key
- current code head `0fffafa2ea69a78bd0fe2c4c25546cbf5879a2bf` has no GitHub Actions verification; its visible commit status is Vercel failure on the account build-rate limit
- none of this is a successful production `npm run build`, and none replaces the explicit exact-head command chain

Still required on one fresh, dependency-complete exact candidate before Task 14 can be called complete:

```text
npm test
npm run typecheck
npm run build:cli
node .scopeforge-build/packages/cli/index.js --version
npm run benchmark:scanner
npm audit --audit-level=info
npm run build
```

The scanner benchmark must remain within the existing catastrophic ceiling. The production build must use a complete ScopeForge application environment; missing Preview-only public Supabase configuration must not be worked around by weakening source validation.

## Task 15 containment acceptance - passed on the dedicated host

Task 15 passed on the dedicated Ubuntu/rootless-Podman/cgroup-v2 host for implementation SHA `faec75ed74e3e919c61d6ac80f249c56ee7f1885` and immutable image digest `sha256:04b5a5e4cf6b77ac3bf0f74a3126df15305ed1d337e11a8e00d13eef46fc9e43`.

The complete 31-item evidence and limitations are recorded in `docs/development/PHASE_6D_TASK15_ACCEPTANCE.md`. The real host proved:

- direct DNS from the executor fails
- direct TCP/HTTPS from the executor fails
- loopback and host services are inaccessible
- only the intended mediator Unix socket is usable
- arbitrary Unix sockets are unavailable
- authorized HTTPS succeeds only through the attempt-bound mediator session
- private, loopback, link-local, reserved, and otherwise prohibited destinations are rejected
- active CORS performs exactly one authorized request
- passive request/redirect/byte/time budgets are enforced
- cancellation aborts in-flight mediator HTTPS work, terminates the executor, and late success is discarded
- memory, process, CPU, wall-time, scratch, input, and output ceilings are enforced
- mediator failure never creates a direct-network fallback
- the measured `--pids-limit=8` cgroup task/thread ceiling is verified against the actual Node runtime; it is not described as a literal one-process limit, and the executor still receives no general process-spawn authority from ScopeForge
- the mediator socket is bind-mounted read-only, the narrowest mode proven connectable on the real host
- socket-root ownership checks and startup failure cleanup behave as expected under rootless Podman

This closes Task 15 for the tested candidate. Production capabilities remain false/absent and Task 16/final exact-head verification still control the disabled merge.

## Task 16 PR/release boundary

Source review through code head `0fffafa2ea69a78bd0fe2c4c25546cbf5879a2bf` confirms:

- changed paths are confined to Phase 6D, its tests/docs, and the reviewed repository-snapshot network-authority extraction
- no package/dependency drift
- no unrelated Phase 7/8 product feature implementation
- every reviewed network import remains within an intended authority boundary
- Phase 6D control/publication RPC ACL and `search_path` posture is live-verified
- cancellation, replay, lease timing, backpressure, one-attempt runtime semantics, atomic publication, mediator ownership, startup cleanup, and in-flight abort propagation have explicit regression guards
- capability gates remain false/absent
- PR #52 remains draft
- no source evidence from GitHub Actions is being relied upon for this phase

Before changing PR #52 from draft or merging it, run the exact-head Task 14 software acceptance above and perform one final base-to-head review against that same SHA. If code changes after the accepted SHA, rerun the affected acceptance rather than treating prior compiler evidence as transferable.

A disabled Phase 6D code merge may occur only if Task 14, Task 15, and final Task 16 review are genuinely green. A merge is **not** permission to enable runtime networking.

## Workflow constraints

- Do not use, trigger, rerun, or depend on GitHub Actions for this phase.
- Continue using `[skip ci]` on implementation, test, migration, and documentation commits.
- Do not rewrite already-applied Supabase migrations; defects are fixed with forward migrations.
- Keep ScopeForge Supabase, worker credentials, mediator session material, R2 credentials, and secrets separate from browser-visible configuration and logs.
