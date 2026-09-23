# ScopeForge Unfinished Work

Last reconciled: 2026-09-23, Asia/Singapore. Live GitHub/provider state wins.

## Product UX and account security

Implementation and local verification are complete on `feat/post-v1-ux-auth-security`, rebased onto live `main` `d74adff99b9d13871afe73ba05d74d715597f5db`. Remaining external gates:

- exact-head CI and reviewed merge;
- exact-main production deployment readiness;
- authenticated rendered route/role/viewport smoke verification;
- live passkey relying-party capability verification for `scopeforge.dev`.

TOTP is the supported AAL2 factor. Email OTP and passkeys must not be relabeled as AAL2. Password/TOTP fallback must remain available if passkeys are provider-disabled.

## Phase 11

No Phase 11 closure blocker remains for the approved initial production scope.

- source implementation: 100%
- operational acceptance: 100%
- completion task: 100%
- accepted run: `37fb0091-a7b2-4a33-8a24-6136deb61143`
- database verdict: `acceptance_ready = true`
- active Phase 11 tasks: zero
- dedicated worker: enabled
- Oracle cleanup: `PHASE11_HOST_CLEANUP_PASS`
- temporary verification proof: removed after acceptance

Preserve all five canaries. Do not run another Phase 11 acceptance canary merely to reconfirm closure.

## Approved roadmap status

No unfinished task remains in the approved ScopeForge v1 roadmap. All 11 delivery phases are complete, so the project completion measure is 100%.

Generic Phase 6D passive/active worker flags, paid or externally administered provider controls, and providers rejected or deferred by reviewed gate decisions are intentional non-v1 scope. If adopted later, each becomes a new roadmap item requiring its own authorization, operational acceptance, rollback evidence, and security review. Their current disabled or unverified state must not be relabeled as active.

One manifest-approved merged remote branch remains intentionally undeleted because its active worktree contains uncommitted user changes. One additional merged local-only worktree with uncommitted files is also preserved. Diverged and intentional remote branches remain preserved.

Do not weaken authorization, network restrictions, containment, worker boundaries, request/runtime budgets, RLS/security controls, or target verification to advance remaining roadmap work.
