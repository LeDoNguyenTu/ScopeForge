# ScopeForge Next Steps

Last reconciled: 2026-09-18, Asia/Singapore.

## Priority 0: finish PR #77 release

1. Run provider replay, lifecycle, newest-head coalescing, same-head recovery, stale-trigger authoritative-head, terminal retry, public/private separation, privacy, rollback, and full webhook -> snapshot -> scan -> findings canaries. GitHub provider `ping` and `installation.new_permissions_accepted` deliveries plus signed ping, unsupported-event 202, invalid-signature 401, and oversize 413 already passed.
2. Require exact-head GitHub CI plus Vercel success after the final acceptance documentation checkpoint. The pre-acceptance documentation head `8b6a3dca3fa72901b064f92ac486e408f360a3a8` is green in CI run `35257848754` and Vercel.
3. Merge normally and verify released `main`, production deployment, migration ledger, advisors, workers, and browser behavior.
4. Reconcile PR #124 only after PR #77 releases.

The seven Phase 10A3 migrations, Vercel production webhook secret, GitHub App webhook endpoint/secret, and required event subscriptions are already deployed. Do not reapply or rotate them merely to repeat work.

## Priority 0: release PR #76

1. commit/push this handoff
2. mark #76 ready
3. require CI and Vercel success for the exact final head
4. merge without force-pushing or deleting unverified branches
5. verify merged `main`, main CI, production, worker health, and the accepted finding

## Priority 1: PR #77 Phase 10A3

Only after #76 is released:

1. reconcile #77 onto released `main`
2. inspect current migrations, webhook contracts, CI, and handoff state
3. run focused/full validation
4. apply only reviewed absent forward migrations
5. configure the server-only webhook secret without exposing it
6. prove signed delivery, replay rejection, lifecycle/coalescing/recovery, privacy, and webhook-triggered snapshot -> scan -> findings
7. release after exact-head CI, Vercel, and production acceptance

## Later work

- review PR #124 Phase 11 architecture
- design backup platform-admin delegation with explicit access-control management
- enable Supabase leaked-password protection
- address measured database performance follow-ups

Do not fabricate state, expose secrets, weaken authorization/RLS/containment, rewrite deployed migrations, or apply Phase 10A3 production state before #76 releases.
