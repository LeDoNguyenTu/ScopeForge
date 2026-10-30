# ScopeForge Next Steps

## 2026-10-30 execution order

1. Preserve the released PR #220/#214 acceptance evidence. Main
   `7e62d103afbcf3561461cb2fe329d9cc214b4f08` is deployed READY as
   `dpl_F8BZ15BQbDLcnmYZWB7qGLgsk3TF`; candidate CI `41033282669` passed.
   Main CI `41038513290` passed. The executable
   candidate `fad381480dc1961e4e3fcc606112f37851354f9f` already passed real Oracle
   external-fixture acceptance and 44 focused Linux tests; fixture/host cleanup is
   verified. See `../validation/post-v1/PHASE12_HOST_TUNNEL_ACCEPTANCE.md`.
2. Prepare the dedicated Phase 12 worker/control-plane design
   and its authorization, migration, rollback and bounded-canary gates for review.
   Do not register/enable a worker or mutate Supabase from the harness release.
3. Keep httpx/Nuclei default-off until their own operational acceptance. Preserve
   Phase 11 acceptance without rerunning it. Later 12B-12H ordering below remains.

This current order supersedes older instructions to implement/run #214 from scratch.

Last reconciled: 2026-10-28, Asia/Bangkok. Live GitHub/provider state wins.

## Active post-v1 roadmap

The approved ScopeForge v1 roadmap remains complete at 11 of 11 phases.

The user has now explicitly adopted Phase 12, **External provider runtime and automated pentest expansion**, as new post-v1 scope.

Current estimated broader automated-pentest product vision: approximately 75% at Phase 12 start.

Active slice: **12A external ProjectDiscovery httpx real host-tunnel acceptance harness**, issue #214. Released `main` is `a577739230a2b717caabfc28e8a33cad2a2e0c64`; production deployment `dpl_6eHQiN19RLYsXLFreRYxVFYh9UhR` is READY, and final main CI `40560380937` passed. PRs #217 and #218 are merged and their release checks are complete.

The product UX/account-security hardening, rendered mobile-navigation correction, TOTP recovery/QR corrections, and scheduled maintenance controls shipped through PR #194. PR #203 released the 2026-09-24 correction that narrows mandatory enrollment to platform administrators, preserves challenges for every enrolled account, and improves dashboard/asset workflow clarity without changing Phase 12 runtime gates. Continue Phase 12 from the live roadmap below.

See:

- `docs/development/PHASE12_ROADMAP.md`
- `docs/development/PHASE12_CURRENT_STATE.md`

## Execution order

1. Preserve the target-free httpx host evidence at runtime candidate `8472f33c9c2ad04b29e436b07b551ac8ed062ae2`: the corrected `scripts/phase12-provider-containment-bundle.sh httpx linux-amd64` passed on Oracle and cleanup was verified. The merged runtime files are identical to this candidate; rerun only if an executable change invalidates the evidence. This does not accept external provider execution.
2. 12A real host-tunnel acceptance, issue #214: add and run one deterministic Linux harness that composes the existing target-bound host tunnel and two-container sandbox. Prove pinned public-IP dialing, hostile host/port/nonce/frame rejection, connection/byte/runtime budgets, cancellation, resource ceilings and idempotent cleanup. Keep it acceptance-only: no worker registration, queue route, migration, production target authority or canary.
3. 12B Nuclei: preserve the single-template default-off runtime foundation and reuse the same two-container target-bound sandbox only after Linux acceptance proves the shared boundary. Keep Nuclei disabled until its own operational gate passes.
4. 12C network/service discovery with Nmap or a reviewed provider-neutral alternative.
5. 12D hosted authenticated browser/API runtime.
6. 12E bounded web/API DAST.
7. 12F expanded proof-only validators.
8. 12G adaptive multi-provider orchestration/correlation.
9. 12H benchmarks, rollback, operational acceptance and closure.

Each network/process authority stays default-off until its own Linux containment and acceptance gate passes.

Frontend parity is released through PRs #202, #205-#209 and #217. Keep `/dashboard/security-runs`, run detail, `/admin/providers`, dashboard and public engine surfaces synchronized with actual backend acceptance state. Issue #213's navigation and #212's admin telemetry follow-ups are released and verified in production. Never make a locked provider appear runnable merely because its adapter or sandbox source exists.

Read-only Supabase verification on 2026-10-28 through connection `214nsa` confirmed the required project `tdgpibrepzcvdivztkta`: no registered Phase 12 provider worker, no active Phase 11 HTTP task, zero direct `anon`/`authenticated` grants on private tables, and one unrelated queued public repository snapshot task intentionally untouched. No database mutation was performed.

## Storage direction

Keep compact structured state in Supabase/Postgres. Put large or unstructured scan artifacts in private Cloudflare R2 with short-lived mediated access. Do not use Postgres as blob storage for raw provider output.

## Repository hygiene

The completed v1 cleanup preserved dirty, diverged, and intentional worktrees/branches. Recheck open PRs and `git worktree list` before future branch deletion.
