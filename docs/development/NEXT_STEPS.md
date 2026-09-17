# ScopeForge Next Steps

Last reconciled: 2026-09-17, Asia/Singapore.

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
