# ScopeForge Next Steps

## Immediate release sequence after accepted PR #77 recovery

1. Commit and push this final acceptance documentation. Accepted source `37c3e68a6e188b30a1c23399449cc794fa776335` is already green in CI `35286439598`, Vercel, production deployment `dpl_HkfuaAJ33qY8cs3xbWJFAPKqRTzV`, live database verification, and authenticated browser acceptance.
2. Require exact-head GitHub CI and Vercel success for the documentation head.
3. Merge PR #77 normally.
4. Verify released `main`, main CI, production deployment, migration ledger, advisors, workers, and authenticated browser behavior.
5. Reconcile PR #124 only after PR #77 releases.

Same-head recovery is complete: `f13f3d72...` is the successful watermark, state is idle, and recovery increased same-head successful scans from two to three while snapshots remained three. Do not run another resume or reacquire this head.

The older task lists below are historical context.
Last reconciled: 2026-09-18, Asia/Singapore.

## Priority 0: finish PR #77 release

1. Confirm the production read model or private reconciliation state shows private-canary head `f13f3d72d0782e4260898201d8dd2f08885a8088` terminal. The real rapid-push transport/worker sequence already returned webhook `202/200` and HTTP 200 through snapshot finalize, scan artifact/finalize, and follow-up snapshot finalize.
2. Run provider redelivery replay, lifecycle removal/re-inclusion, same-head recovery, stale-trigger authoritative-head, terminal retry, public/private separation, privacy, rollback, and a separate public webhook -> snapshot -> scan -> findings canary. GitHub provider `ping` and `installation.new_permissions_accepted` deliveries plus signed ping, unsupported-event 202, invalid-signature 401, and oversize 413 already passed.
3. Require exact-head GitHub CI plus Vercel success after the final acceptance documentation checkpoint. Activation checkpoint `a9f86a58e735076e4fdb8ceee7d0179aa27cb2c5` is green in CI run `35261201693` and Vercel.
4. Merge normally and verify released `main`, production deployment, migration ledger, advisors, workers, and browser behavior.
5. Reconcile PR #124 only after PR #77 releases.

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
