# ScopeForge Unfinished Work Queue

Last reconciled: 2026-08-31

This file is the persistent resume queue for unfinished ScopeForge work. It exists so later sessions continue from repository state rather than conversation memory.

## Global execution rules

- Do not use, trigger, rerun, or depend on GitHub Actions while the monthly allowance remains exhausted.
- Every repository implementation/documentation commit made through this workflow must contain `[skip ci]`.
- Do not claim tests, typecheck, builds, audits, database state, sandbox containment, or runtime gates are green without fresh evidence tied to the exact candidate SHA.
- Existing deployed Supabase migrations are immutable. Any database correction is forward-only.
- Keep `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED=false` and `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED=false` unless separately reviewed acceptance authorizes them.
- Keep `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED=false` and `HOSTED_ACTIVE_CORS_WORKER_ENABLED=false` throughout Phase 6D review/merge. A disabled merge does not authorize runtime enablement.
- Turnstile is not active and must not be described as active.
- Do not add generic URL, HTTP, fetch, proxy, browser-automation, arbitrary-header/body, credential-replay, port-scanning, or unrestricted network authority.
- Phase 6B GitHub networking is not reusable Phase 6D egress authority.

## Current Phase 6D review state

Implementation branch:

`feat/phase-6d-network-workers-v1-task14`

Draft implementation PR:

`#52 - Phase 6D dedicated network workers implementation [skip ci]`

PR #52 is based on `design/phase-6d-network-workers-v1`, whose docs-only PR #51 remains draft. The available connector currently cannot transition PR #51 out of draft because its GitHub GraphQL mutation is incompatible with the current schema. Do not force or bypass that state.

### Tasks 1-13

The planned source implementation through Task 13 is present. The reviewed forward Phase 6D migrations have been applied to ScopeForge Supabase and live authority was reconciled. This includes:

- two closed runtime execution classes only
- `max_attempts = 1`
- immutable runtime task/domain-job binding
- lease-bound preparation and Phase 4 reauthorization
- class-aware one-shot mediator
- networkless executor contract
- trusted cancellation/replay-aware publication
- dashboard cutover with no direct Vercel network fallback
- global/class/workspace backpressure
- terminal lost/expired-attempt recovery
- aggregate-only runtime fleet health
- permanent import/authority architecture guards
- service-role-only intended public RPCs and private helper/table restrictions

Do not reopen Tasks 1-13 as if they were unimplemented. Revisit them only if Task 14/15/16 verification exposes a concrete defect.

## Active Phase 6D gates

### 1. Task 16 source security review - active

Draft PR #52 remains intentionally unready.

Source review still needs to remain exact-head aware and cover:

- every changed path for unrelated authority expansion
- worker task/result contracts
- all network imports
- every `SECURITY DEFINER`/grant boundary if a new SQL change appears
- cancellation, replay, lost-attempt, one-shot, and cleanup ordering
- audit/log/telemetry leakage
- direct-network fallback
- dependency drift
- all final review commits containing `[skip ci]`

Recent review fixes already landed:

- canonical worker cancellation now matches database semantics: cancelled terminals carry `failureCode = null` and no result payload
- the public worker-contract validation boundary preserves cancellation while retaining strict metric/result validation
- active CORS worker observations are explicitly reconstructed from validated fields
- runtime mediator framing exposes decoder pending state and rejects a valid frame followed by trailing partial frame bytes
- mediator/server accepts exactly one complete request frame per socket

Reviewed Phase 6D audit events expose safe IDs, class/state/outcome/timing/version metadata only. The reviewed event payloads do not include lease tokens, mediator nonces, target URLs, raw response bodies, cookie values, authorization material, resolver transcripts, or remote exception strings.

Runtime fleet data remains aggregate-only for Phase 6D classes.

### 2. Task 14 software acceptance - blocked on a complete runner

The exact final candidate must receive fresh execution evidence for the full accepted command chain. At minimum run and inspect:

- focused Phase 6D tests
- full `npm test`
- `npm run typecheck`
- CLI build/version checks required by the existing project acceptance process
- scanner benchmark/performance guard
- `npm audit` or the repository's accepted dependency audit command
- production Next.js build

Historical Vercel previews are diagnostic evidence only. They exposed several real TypeScript defects that were repaired, but they are not a substitute for a clean exact-head acceptance run.

Do not spend deployment quota polling or manually retrying Vercel while the platform limit remains authoritative.

### 3. Task 15 real Linux containment acceptance - hard runtime-enable gate

This cannot be satisfied by unit tests or source review.

Use a dedicated Linux worker host with rootless Podman and cgroup v2. Record OS, kernel/cgroup mode, Podman version, immutable runtime image digest, and exact ScopeForge commit.

Prove:

- exact generated container command starts successfully
- executor direct DNS fails
- executor direct public TCP/HTTPS fails
- executor cannot reach supervisor/host TCP services
- only the dedicated Unix mediator socket is usable
- arbitrary host Unix sockets are unavailable
- mediator performs only the prepared authorized HTTPS operation
- private/loopback/reserved targets remain rejected
- active CORS performs exactly one request and its session cannot replay
- passive request/redirect budgets hold over the entire attempt
- cancellation stops mediator activity, terminates the Podman workload, and late success cannot publish
- memory, PID/process, CPU/wall-time, scratch, and output ceilings are enforced
- mediator failure never causes a direct-network fallback

Explicit host questions discovered during Task 16 source review:

1. Verify whether `--pids-limit=1` is actually compatible with the Node runtime under rootless Podman. Linux cgroup PID accounting includes tasks/threads, so this must be measured. Do not loosen the limit from source speculation alone.
2. Test whether the single mediator socket bind can be made explicitly read-only while still allowing the executor to connect. If yes, tighten the command and add regression coverage. If not, document the host/runtime reason and maintain the smallest possible writable host surface.
3. Verify abort/cancellation cannot return from the Podman executor until the hostile process is actually stopped. Phase 6D intentionally waits for killable sandbox termination before cleanup/finalization rather than detaching.

Neither Phase 6D production capability may be enabled before this evidence is reviewed.

### 4. Final Task 16 release decision

After Tasks 14 and 15 have real evidence:

- refresh PR #52 exact head
- reconcile its final diff and commit list
- confirm no GitHub Actions were used
- confirm every new implementation/documentation commit has `[skip ci]`
- ensure both Phase 6D runtime flags remain false
- review any PR comments/threads
- mark ready only if the exact-head acceptance record supports it
- merge only with exact-head protection
- verify production remains disabled after merge

A disabled merge before Task 15 is technically permitted by the design, but current policy is to keep PR #52 draft until the unresolved acceptance risk is explicit and the exact-head release decision is made.

## Later roadmap

### Phase 8 validation methodology follow-on

Draft PR:

`#50 - Phase 8 validation methodology foundation [skip ci]`

Still required:

- versioned labeled vulnerable labs
- machine-readable ground-truth manifests
- negative-control fixtures
- rule-level TP/FP/FN evaluator
- precision/recall/F1 only after a committed labeled corpus exists
- additional realistic performance fixtures
- justified regression thresholds
- reproducibility metadata and artifact provenance
- public technical methodology/report output
- review and merge of PR #50 when its scope is ready

Do not invent unsupported accuracy claims before the corpus/evaluator exists.

### Phase 7 Community Security Packs

Still unfinished. Preserve the product goal of community-extensible security knowledge without allowing packs to become arbitrary hosted code or generic network authority.

Before implementation, design and approve:

- manifest/version/provenance model
- deterministic rule/policy boundaries
- signing/trust/review model as appropriate
- compatibility/versioning
- safe loading/execution model
- community contribution workflow
- protection against pack-supplied executable commands, arbitrary networking, credentials, or unrestricted execution

### Phase 9 public-release hardening and operations

Still unfinished. Include at minimum:

- abuse/rate-limit policy for public trial use
- production capability enablement runbooks
- worker fleet operational monitoring
- incident/rollback procedures
- security logging/privacy review
- truthful auth/bot-protection readiness
- release documentation/support boundaries
- final threat-model reconciliation
- production smoke/rollback checks
- dependency/security advisories
- public-release acceptance evidence

Do not enable a capability merely because implementation code exists.

### Documentation reconciliation after Phase 6D

`docs/development/CURRENT_STATE.md` and other main-facing status documents must reflect the actual merged/deployed state only after the final Phase 6D release decision. Do not advertise Phase 6D as production-enabled before Task 15 and explicit enablement review.

## Parked operational work

### Command center UI v4 - PR #49

PR #49 remains parked behind the relevant Vercel build/deployment limit. Do not spend active Phase 6D review time polling it.

### Temporary Floot operations helper cleanup

A temporary Floot production-operations helper cleanup remains quota-dependent. Stored credentials must not be deleted. Remove only the proven temporary helper when the relevant operation capacity is available.

## Resume order

Unless a new security finding changes the dependency graph:

1. Continue Task 16 source review on draft PR #52 and repair concrete findings only.
2. Run Task 14 exact-head software acceptance as soon as a complete independent runner is available.
3. Run Task 15 on a dedicated rootless-Podman/cgroup-v2 Linux host, including the PID-limit and socket-mount questions above.
4. Perform the final exact-head Task 16 release review and disabled merge decision.
5. Reconcile main-facing Phase 6D documentation after merge/deployment state is known.
6. Continue Phase 8 methodology/evaluator work and reconcile PR #50.
7. Design and implement Phase 7 Community Security Packs.
8. Complete Phase 9 public-release hardening/operations.

Rate-limit-only work should remain parked instead of interrupting the active security review.
