# ScopeForge Current State

Last reconciled: 2026-09-19, Asia/Singapore. Live provider state wins.

## Released baseline

- `main`: `30b45974126797509eb66dd12f26528970a7bdee`.
- PR #141 released the hardened default-off Phase 11C provider contracts.
- PR #142 released the bounded first-party HTTP discovery mediator/runtime foundation.
- Vercel Hobby deployment filtering remains active: ordinary feature branches do not deploy automatically.

## Active implementation

PR #143, branch `feat/phase-11c-http-worker-control-20260919`, is the active Phase 11C source-only worker-control slice.

It now contains:

- immutable Phase 11 HTTP worker-task bindings
- replay-safe service-role-only enqueue
- dedicated registration and claim
- lease-bound authenticated preparation and finalization routes
- authoritative run/action/snapshot/target/capability revalidation
- atomic normalized observation and action-attempt finalization
- cancellation and terminal replay protection
- generic worker claim/terminal parsing for `phase11_http_discovery_v1`
- dedicated supervisor prepare/finalize routing
- explicit Phase 11 HTTP executor dispatch
- reuse of the existing single-use Unix mediator and networkless Podman sandbox

The dedicated Phase 11 input and terminal validators remain authoritative after generic wiring.

## Production boundary

- ScopeForge Supabase: `tdgpibrepzcvdivztkta`.
- Phase 11 and Phase 11C migrations remain source-only and unapplied.
- Production migration history still ends at Phase 10A3.
- Hosted `phase11_http_discovery_v1` execution remains disabled.
- The normal worker runtime configuration still cannot select the Phase 11 HTTP class.
- No external Nmap, Nuclei, or httpx process runner is enabled.

## Next

1. finish exact-head PR #143 CI after the request-accounting hardening and correct any regression
2. merge the source-only slice only when its exact head is green
3. prepare the immutable runtime image candidate
4. run real Linux rootless-Podman/cgroup-v2 containment acceptance for `phase11_http_discovery_v1`
5. keep production migration application and hosted enablement as separate reviewed gates


### Latest PR #143 hardening

The final release review fixed two issues before merge:
- the concrete Supabase queue repository now has explicit typed enqueue/cancel inputs after CI #1193 found test-only-clean TypeScript implicit-any errors
- failed/cancelled HTTP attempts can no longer erase consumed request budget; exact counts are retained when available and otherwise the authorized maximum is charged conservatively
