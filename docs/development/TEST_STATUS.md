# ScopeForge Test Status

> **2026-09-01 current evidence:** Phase 6D exact-head executable acceptance is
> recorded in `PHASE_6D_TASK15_ACCEPTANCE.md` and release reconciliation in
> `PHASE_6D_TASK16_REVIEW.md`. The older Phase 6C-focused statement at the end
> of this file is historical and does not supersede those records.

## GitHub Actions constraint

GitHub Actions monthly allowance is exhausted. The user explicitly requested no further GitHub Actions use, reruns, or dependency on workflow status as merge evidence.

Repository implementation, test, migration, dependency, merge, and documentation commits continue to use `[skip ci]`. Verification is performed independently and tied to the exact candidate SHA.

## Phase 6B historical acceptance

Phase 6B repository acquisition merged through PR #38 before a dependency-complete external verifier was available for that exact merge candidate.

Its original merge evidence therefore consisted of test-first repository contracts, targeted exact-head security/source review, live Supabase migration/ACL/RLS/function/index verification, clean security advisor results, generated-type comparison, and rollback-only production workflow smoke. That historical Phase 6B merge should not be retroactively described as having had a full green npm/Vitest/build run at merge time.

The later acquisition public-runtime gate was implemented and fully verified after the external verifier became available. See the dedicated section below.

## Phase 6C exact-head acceptance

Phase 6C isolated zero-egress repository scanning merged through PR #39.

- exact verified feature head: `d0b7c7a3a1de9d626478cf75cad5ee809f52dc3b`
- merge commit: `7a329dc2796a142102af2392ee461f205daa1b78`
- PR merge used expected-head SHA protection
- unresolved review threads: none
- PR comments/review submissions at merge time: none

### Dependency integrity

The exact committed lockfile was generated from the unchanged manifest plus the previously committed complete lock through npm's resolver and independently checked before branch mutation.

- byte length: 118,878
- package entries: 235
- SHA-256: `3bbc74fa07cf06b379058c741423974f30b46f5c4469694750e1b973fbccda7d`
- Git blob: `881bbdeedb0ee7a7cb8c171ca93b14f6e528d33d`
- Next: 15.5.24
- PostCSS: 8.5.26
- Sharp: 0.35.3

The Phase 6C branch commit that refreshed the lock changed only `package-lock.json` relative to the already security-reviewed head `11b356ec05feaa8cb8f43d81f51516686fb6f3a5`.

### Fresh exact-head verification on `d0b7c7a3...`

- `npm ci`: passed
- `npm run typecheck`: passed
- `npm test -- --run`: 227/227 test files, 952/952 tests passed
- `npm run build:cli`: passed
- `node .scopeforge-build/packages/cli/index.js version`: `ScopeForge 0.1.0`
- `npm run benchmark:scanner`: 700 files, 0 findings, 0 errors, wall time 509 ms against 20,000 ms maximum
- production `npm run build`: passed with `NODE_ENV=production`, the ScopeForge public Supabase production configuration, and `NEXT_PUBLIC_SITE_URL=https://scopeforge.dev`
- `npm audit --json`: zero info, low, moderate, high, critical, and total vulnerabilities

A combined verifier process hit its sandbox wall-time after completing the first six gates, so the production build and audit were rerun as separate clean exact-SHA materializations. Both passed. The timeout itself is not counted as build/audit evidence.

## Phase 6C security acceptance

Static and executable review covered:

- browser hosted-scan fail-closed runtime flag
- worker credential and execution-class binding
- exact lease/task/attempt/worker binding
- private R2 artifact access with short-lived authorization
- fixed HTTPS/R2 host policy and redirect refusal
- exact artifact byte count and SHA-256 verification
- path-safe bounded snapshot materialization
- fixed rootless-Podman command/image/network/resource profile
- cancellation and hard-deadline process termination paths
- artifact digest provenance at supervisor and trusted publication layers
- exact snapshot, repository URL, commit, content digest, and artifact digest publication binding
- generic-finalizer rejection of repository-scan success
- cancellation-wins publication semantics
- service-role-only `SECURITY DEFINER` RPCs with empty `search_path`
- Phase 6C follow-up migrations covering asset identity and event ambiguity

No new merge-blocking security defect was found in the final static review.

## Production runtime acceptance still missing by design

The Phase 6C code merge is not permission to enable hosted repository scanning.

Production runtime enablement still requires real Linux rootless-Podman/cgroup-v2 evidence for:

- zero network access from the scanner container
- read-only input/root filesystem boundaries
- enforceable CPU, memory, process, scratch, input, output, and wall-time limits
- cancellation/hard deadline killing the underlying container
- fixed reviewed image and command

Until that evidence exists, the public server action remains fail closed and hosted repository scanning must remain disabled.

## Phase 6B acquisition public-runtime gate

After Phase 6C merge, ScopeForge added a separate fail-closed capability for public repository acquisition so a Vercel control-plane deployment cannot enqueue work when the dedicated acquisition worker/private R2 runtime is absent.

TDD evidence:

- RED head: `8b878860174369b887aaeda5415fec445f83e7b5`
- all six pre-existing focused assertions passed
- exactly the new server gate, page wiring, and unavailable UI behaviors failed

Final verified head:

`f1e67a07250f194f315d5be1081b780f62da4f26`

Fresh verification:

- focused tests: 9/9 passed
- `npm ci`: passed
- `npm run typecheck`: passed
- full suite: 227/227 test files, 955/955 tests passed
- `npm run build:cli`: passed
- CLI version: `ScopeForge 0.1.0`
- scanner benchmark: 700 files, 0 errors, wall time 523 ms
- production Next.js build: passed
- `npm audit`: zero vulnerabilities at every severity
- dependency lock SHA-256 remained `3bbc74fa07cf06b379058c741423974f30b46f5c4469694750e1b973fbccda7d`

The gate merged through PR #41 as merge commit `07c6bc8580314b73c633a7b704e5f7557ceccb4d`.

`HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED` remains `false`, is enforced before privileged enqueue, and is surfaced as a disabled owner/admin control in the UI. Existing snapshot history remains readable.

## Deployment-readiness docs

Deployment/environment reconciliation merged through PR #40 as `415428ebc510a7a8e890d3a03ebc4ffb8194252a`.

This records the Vercel control-plane deployment boundary, server-only Supabase secret, planned worker/R2 separation, Cloudflare/Vercel DNS/TLS responsibilities, and the requirement to keep hosted repository worker features disabled until their runtime acceptance gates are proven.

## Supabase state

ScopeForge production project is `tdgpibrepzcvdivztkta`.

Phase 6B and Phase 6C deployed migrations are immutable. Further changes use forward migrations only.

Existing security review confirmed the intended RLS/ACL/private-table separation, service-role-only trusted RPC surfaces, empty `search_path` on trusted functions, and no direct browser authority over worker-private state. Do not remove operational/FK indexes solely because a young project reports them as unused.

## Current verification statement

The repository has executable, exact-SHA evidence for the completed Phase 6C candidate, the subsequent public acquisition runtime gate, and Phase 6D implementation head `bd558fdf0830bfdb95027374e168835a8a48f43d`. GitHub Actions were not used for that evidence.

Phase 6D source/security review and real Linux containment acceptance passed. Its release reconciliation is still incomplete because fresh read-only access to the exact Supabase project is unavailable. Do not infer production enablement from implementation acceptance; both Phase 6D capability flags remain false/absent.
