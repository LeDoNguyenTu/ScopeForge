# ScopeForge Unfinished Work

Last reconciled: 2026-10-28, Asia/Bangkok. Live GitHub/provider state wins.

## Active Phase 12 post-v1 work

The approved v1 roadmap remains complete. These are adopted post-v1 Phase 12 items, not reopened v1 blockers:

1. **Issue #214 - real host-tunnel Linux acceptance harness.** Compose the existing target-bound host tunnel and two-container sandbox in deterministic acceptance tooling. First run PR #211's `scripts/phase12-provider-containment-bundle.sh` on the accepted Linux/Oracle host, then prove pinned-IP dialing, hostile-frame rejection, budgets, cancellation, resource ceilings and idempotent cleanup. Do not add a worker class, queue route, migration, production target authority or canary in this slice.
2. **Issue #213 - one mobile workspace navigation scroll owner.** Remove the nested horizontal scroll-owner conflict while preserving desktop behavior, keyboard/touch access, `aria-current`, the separate admin rail and no document-level overflow.
3. **Issue #212 - expected admin redirects in telemetry.** Redirect unauthenticated admin document requests before child Server Components can emit expected authorization errors, while preserving Supabase cookie refresh, nonce/CSP propagation, fail-closed non-admin handling and throwing authorization for privileged mutations.
4. **Operational acceptance after #214.** Only after the shared Linux boundary passes may a dedicated Phase 12 worker/control-plane design and separately authorized bounded canaries be considered. httpx and Nuclei remain default-off.

Exact repository checkpoint: `main` `9324dd177bd75b060b197416f3025eb10d28c194`, CI `36074135221` successful, Vercel deployment `dpl_3woeXP9VsmezyAoXgKMfpeneKNHs` READY, zero open pull requests. Read-only Supabase verification on 2026-10-28 confirmed project `tdgpibrepzcvdivztkta`, no registered Phase 12 provider worker, zero active Phase 11 HTTP tasks, one unrelated queued public snapshot task, and zero direct private-table grants to `anon` or `authenticated`.

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

Current worktree enumeration shows one local `main` worktree. Recheck remote refs, open PRs and worktree attachments before any future branch deletion; historical cleanup counts are not current evidence.

Do not weaken authorization, network restrictions, containment, worker boundaries, request/runtime budgets, RLS/security controls, or target verification to advance remaining roadmap work.
