# ScopeForge Current State

Last reconciled: 2026-09-05 (Asia/Singapore)

This file is the authoritative non-UI current-state summary. Dashboard V5/UI work remains a separate active workstream and is intentionally excluded from mutation here.

## Repository state

- repository: `LeDoNguyenTu/ScopeForge`
- Phase 7 release merge: `1e9a72e0c4a526b064d6d3729981b405fac6b2b1`
- merged PR: #54, Phase 7 Community Security Packs v1
- final accepted PR head: `b10f04f87ff06a81106b585973c3e7872571bfa6`
- exact final CI: #756, success
- production Vercel deployment: `dpl_9dHDoELwaxXMgAerv8LufwDEjC8B`, READY, aliased to `scopeforge.dev`

This post-merge documentation checkpoint is a docs-only descendant of the Phase 7 release merge and does not change executable behavior.

## Completed architecture boundaries

Phases 1-5C are complete. Phase 6A worker foundation, Phase 6B acquisition code, Phase 6C isolated scanner code, Phase 6D dedicated network-worker code/release acceptance, and Phase 7 local-only Community Security Packs v1 are merged.

Code merge is not runtime authorization. Worker-backed production capabilities remain separate enablement gates.

## Phase 7 final acceptance

Community Security Packs v1 is complete for its approved local-only boundary:

- strict bounded pack manifests
- exactly `static_literal_v1`
- bounded non-backtracking path matching
- identity-checked byte reads
- deterministic findings/fingerprints/order
- safe fixture validation
- CLI validate/inspect/explicit scan integration
- native local output compatibility
- permanent hosted-json rejection
- first-party example pack and author/reviewer governance

Final CI #756 validated the proposed PR merge tree on GitHub-hosted Ubuntu 24.04:

- 299/299 test files, 1,282/1,282 tests passed
- typecheck passed
- CLI build/version passed (`ScopeForge 0.1.0`)
- 700-file benchmark passed at 888 ms / 20,000 ms ceiling
- production Next.js build passed with 9/9 static pages generated

Preflight also recorded zero npm-audit vulnerabilities and a clean Phase 7 source/security review with no unresolved reportable finding.

## Production Supabase

ScopeForge production Supabase project:

`tdgpibrepzcvdivztkta`

Never confuse it with the separate Job Command Center project.

The latest read-only reconciliation found no enabled Phase 6D worker fleet/activity. Existing deployed migrations are immutable; future corrections are forward-only.

Outstanding hardening: Supabase leaked-password protection is disabled. Carry this into Phase 9 rather than treating it as a Phase 7 defect.

## Production runtime gates

Keep false/absent unless their separate operational acceptance authorizes enablement:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

Phase 7 merge did not change these gates.

## Vercel

- project: `scopeforge` / `prj_r7X4rdsjvwzp2tvuSA4D39gpITb8`
- team: `team_WEcf1g1YcD6vYU8LD5jVUOKF`
- production domain: `scopeforge.dev`
- Phase 7 production deployment: `dpl_9dHDoELwaxXMgAerv8LufwDEjC8B`, READY, `aliasError=null`

The earlier Preview failure was fixed by providing only browser-safe ScopeForge Supabase public configuration. No server/service-role secret was committed.

## UI isolation

The active dashboard V5/UI preview stream remains separate. Non-UI roadmap work must not edit, merge, replace, retarget, or deploy that branch. Reconcile only after both streams have independently stable acceptance evidence.

## Next non-UI boundary

Broader Phase 8 validation/benchmark/public-methodology implementation is next. Production acceptance for 6B/6C/6D worker runtimes and Phase 9 hardening remain separate workstreams.
