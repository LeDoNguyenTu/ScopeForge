# ScopeForge Next Steps

Last reconciled: 2026-09-16, Asia/Singapore

## Priority 0 — Codex must finish Phase 10A2 host/runtime acceptance first

When Codex next has an authorized OCI/SSH terminal, its first task is `docs/development/CODEX_PRIORITY_0_HOST_ACCEPTANCE.md`.

Do not spend that host-capable session redoing issue #79, Phase 10A2 schema deployment, existing hardening PRs, or the canary fixture unless fresh evidence proves a regression. The release is waiting on real Linux worker/private-repository acceptance.

If no authorized host terminal is available, preserve Priority 0 and continue only safe independent repo-side work that cannot weaken or falsely satisfy the release gate.

Already complete; do not repeat:

- issue #79 provider authorization acceptance
- reconciliation of PR #76 onto current main at the recorded checkpoint
- exact executable candidate validation for `4ef285473402336b4488af4e1c2b4b1ea28d5eb7`
- CI `35102938452` success
- exact-head executable Vercel preview READY
- Phase 10A2 production migrations applied
- production schema/function/ACL/advisor inspection
- purpose-built private canary fixture at `LeDoNguyenTu/scopeforge-private-canary@d95ca07123e28ee64de799e87651c2a3b6edb5cf`

Priority 0 execution order:

1. restore authorized access to the dedicated Oracle Linux worker host
2. verify exact live PR #76 head and ensure no executable change superseded `4ef28547...`
3. verify Node 24, rootless Podman, cgroup v2, systemd delegation, `scopeforge-worker`, disk/memory/PID prerequisites
4. run `npm ci` and `npm run build:workers` from the exact candidate
5. deploy worker bundle and build the pinned scanner image; record its immutable digest
6. generate worker credentials only on the host, store mode-0600, and register only credential hashes
7. start private snapshot + zero-egress scan workers while repository runtime gates remain disabled; prove authenticated idle claims/heartbeats
8. through the legitimate GitHub owner/admin flow, ensure `LeDoNguyenTu/scopeforge-private-canary` is included in the ScopeForge GitHub App installation's selected repositories
9. enable only the Phase 10A2 repository gates for a bounded canary window
10. connect/import the private canary normally; do not insert repository-link rows manually
11. run the scan and prove exact private archive lease -> immutable snapshot -> zero-egress scan -> high-confidence `jsts/command-injection` / CWE-78 finding
12. verify cancellation, worker/task cleanup, scratch/output/resource ceilings, observability, privacy-reduced logs, credential isolation, and rollback
13. if any gate fails: disable repository runtime gates, stop workers if needed, preserve evidence, fix via TDD, and repeat exact-candidate acceptance
14. if every gate passes: mark #76 ready, merge with expected head, verify post-merge main CI and exact production deployment

## Priority 1 — safe independent repo-side work while Priority 0 is externally blocked

Allowed while the host is unreachable:

- inspect and fix clearly demonstrated security/correctness defects through TDD on isolated branches
- improve deterministic worker deployment/acceptance tooling without enabling production gates
- harden tests and architecture guards
- reconcile durable documentation with live evidence
- review stale branch/PR state without deleting anything that cannot be proven safe

Do not mutate production migrations, worker identities, repository links, or runtime gates merely to make progress look larger.

## Priority 2 — Phase 10A3 only after #76 production verification

PR #77 remains draft at `d9466f40e38e84e2fc694396c5947aa0f95a2d5d`.

After #76 release:

1. reconcile #77 onto released Phase 10A2/main
2. run fresh exact-candidate validation
3. re-read production migration history; apply only reviewed absent Phase 10A3 migrations
4. configure the independent server-only webhook secret/endpoint without exposing it
5. run all signed-delivery/replay/lifecycle/coalescing/recovery/privacy canaries
6. prove a complete webhook-triggered immutable snapshot -> scan -> findings flow
7. merge/release only after acceptance and production verification

## Non-blocking follow-up

Supabase Performance Advisor reports INFO-level unindexed-FK and unused-index suggestions. One Phase 10A2 item is the composite GitHub-link/workspace FK, whose current partial index begins with the link ID. Do not mutate the release candidate solely for this INFO-level optimization; handle it in a separate measured performance hardening change after Phase 10A2 release unless production evidence makes it urgent.

## Never do to shortcut acceptance

- do not fabricate worker identities, repository links, memberships, or findings
- do not copy SSH/private/provider/worker secrets into Git, chat, PR bodies, Vercel, or Supabase data rows
- do not use unrelated private repositories as the canary
- do not enable Phase 10A3 early
- do not treat historical Phase 6D containment as Phase 10A2 exact-candidate acceptance
