# ScopeForge Current State

Last reconciled: 2026-09-05 (Asia/Singapore)

This file is the authoritative non-UI current-state summary. Dashboard V5/UI work remains a separate active workstream and is intentionally excluded from mutation here.

## Repository state

- repository: `LeDoNguyenTu/ScopeForge`
- `main`: `4ec80199ed922a5d9c92041e5432a8355f4a4277`
- `main` includes the merged Phase 6D dedicated network-worker implementation from PR #52
- active non-UI implementation PR: #54, Phase 7 Community Security Packs
- Phase 7 branch: `feat/phase-7-community-security-packs-v1`
- fully tested Phase 7 executable/source candidate: `e8bef81d36090402cab7af77e549e3ef268c4eef`

Read `PHASE_7_RELEASE_STATE.md` for exact acceptance and integration state.

## Completed architecture boundaries

Phases 1-5C are complete. Phase 6A worker foundation, 6B public GitHub acquisition code, 6C isolated zero-egress repository scanning code, and 6D dedicated network-enabled worker code are merged.

Code merge is not runtime authorization. Worker-backed production capabilities remain separate enablement gates.

## Phase 7 candidate

Community Security Packs v1 is implemented as a local-only, explicitly selected, data-only scanner extension.

V1 provides:

- strict bounded pack manifests
- exactly `static_literal_v1`
- bounded path matching without RegExp backtracking
- identity-checked byte reads
- deterministic findings and ordering
- safe fixture validation
- CLI validate/inspect/explicit scan integration
- native local output compatibility
- permanent hosted-json rejection
- one first-party example pack and contributor/reviewer governance

It does not add executable plugins, network rules, pack auto-discovery, hosted uploads, browser pack management, worker authority, or database mutation.

## Phase 7 verification state

On executable/source candidate `e8bef81d...`:

- focused: 19 files / 129 tests passed
- full suite: 299 files / 1,282 tests passed
- typecheck passed
- CLI build/version passed (`ScopeForge 0.1.0`)
- first-party pack validation passed
- repeated inspection output was byte-identical
- scanner benchmark passed at 338 ms / 20,000 ms ceiling
- npm audit reported zero vulnerabilities
- Vercel Preview deployment is READY with 9/9 pages prerendered
- source/security review has no unresolved reportable finding

One final exact-head GitHub Actions run remains to provide the non-root Linux release gate after documentation-only reconciliation.

## Production Supabase

ScopeForge production Supabase project:

`tdgpibrepzcvdivztkta`

Never confuse it with the separate Job Command Center project.

The latest read-only production reconciliation found no enabled Phase 6D worker fleet/activity. Existing deployed migrations are immutable; future corrections are forward-only.

The outstanding Supabase security-hardening warning is leaked-password protection being disabled. Carry this into Phase 9 rather than treating it as a Phase 7 defect.

## Production runtime gates

Keep false/absent unless their separate operational acceptance authorizes enablement:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

Phase 7 does not change these gates.

## Vercel

- project: `scopeforge` / `prj_r7X4rdsjvwzp2tvuSA4D39gpITb8`
- team: `team_WEcf1g1YcD6vYU8LD5jVUOKF`
- production domain: `scopeforge.dev`
- production remains on `main`

Phase 7 Preview failures were traced to missing browser-safe Supabase public configuration. `vercel.json` now provides the public URL/publishable key required to prerender auth pages. The resulting Phase 7 Preview deployment completed successfully. No server/service-role secret was exposed.

## UI isolation

The active dashboard V5/UI preview stream remains separate. Non-UI Phase 7 work must not edit, merge, replace, retarget, or deploy that branch. Later branch reconciliation should occur only after both streams have independently stable acceptance evidence.

## Next non-UI actions

1. finish the Phase 7 documentation-only release checkpoint
2. preflight that exact head
3. trigger one final exact-head CI run via PR `ready_for_review`
4. merge PR #54 with exact-head protection if green
5. continue broader Phase 8 validation/public-methodology implementation
6. separately complete production acceptance for 6B/6C/6D runtime enablement
7. continue Phase 9 hardening, including leaked-password protection, abuse controls, observability, private-schema defense-in-depth, incident readiness, and release engineering
