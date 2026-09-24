# ScopeForge Unfinished Work

Last reconciled: 2026-09-24, Asia/Singapore. Live GitHub/provider state wins.

## Dashboard/MFA correction

No dashboard/MFA correction item remains. PR #203 passed exact-head Linux CI, merged as `eba081c806f8da078a3fd6b84b06de2bfd32ded4`, reached READY production deployment `dpl_6L2DTXRFjpp3WMrj3iWdeLSLogFq`, and passed authenticated read-only rendering. Platform-admin-only mandatory enrollment, enrolled-factor challenges, post-enrollment navigation, optional workspace-role recommendations, capability-aware scan controls, optional repository import, and the factual attack-surface overview are released. No production database or worker change was required.

## Product UX and account security

PRs #186 and #187 are merged, both exact-head CI runs passed, Vercel deployed both merges, and authenticated production rendering confirmed the account-security route, live passkey provider capability, compact navigation, and no document-level overflow across the final viewport matrix. No product UX/account-security closure item remains.

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
