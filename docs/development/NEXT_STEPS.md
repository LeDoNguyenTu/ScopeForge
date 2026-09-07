# ScopeForge Next Steps

Last reconciled: 2026-09-08 (Asia/Singapore)

## Completed non-UI phases

- Phase 7 Community Security Packs v1: complete, PR #54 merged.
- Phase 8A offline accuracy foundation: complete, PR #55 merged.
- Phase 8B scanner performance matrix: complete, PR #56 merged.
- Phase 8C reproducible technical publication: complete, PR #57 merged as `a8feb63a8ca00dcbbc52b0eb32c6880cb38670d1`.

Do not recreate completed Phase 7 or Phase 8 work.

## Phase 8C release reference

- merged PR: #57
- final verified PR head: `1964d2b581d61190eb95a82e34f233aa36a5ee2a`
- verified candidate tree: `68a8e502b40594778776d1fb627e6cf806158dca`
- final PR CI #764: success
- squash merge: `a8feb63a8ca00dcbbc52b0eb32c6880cb38670d1`
- post-merge main CI #765: success
- production deployment: `dpl_HFrLZmrPAhFPYvq8SDCJQRYDjJpe`, READY on the exact merge SHA
- release state: `docs/development/PHASE_8C_RELEASE_STATE.md`
- publication methodology: `docs/validation/PUBLICATION.md`
- committed evidence: `validation/publication/phase-8-release-v1.evidence.json`
- human report: `docs/validation/reports/phase-8-release-v1.md`

Phase 8C remains local/offline publication infrastructure. It does not authorize production workers, hosted scanning, repository acquisition, browser authority, arbitrary network access, or Supabase writes.

## Immediate non-UI priority - Phase 9 security hardening

Phase 9 is the next non-UI boundary. It has not been started by the Phase 8C release checkpoint.

Begin with a fresh security design and threat-model review against the released `main` baseline. Do not jump directly into operational changes before defining acceptance, rollback, and evidence requirements.

Planned hardening areas:

1. Review and, where appropriate, enable Supabase leaked-password protection without weakening existing authentication behavior.
2. Review authentication, session, API, worker, and public-surface abuse cases and define rate-limit/abuse-control requirements.
3. Add Turnstile or an equivalent challenge only where the threat model and actual implementation justify it. Do not document a control as present before it exists.
4. Define production observability and alerting for security-relevant failures, worker health, authorization failures, and abnormal traffic.
5. Strengthen private-schema and database defense-in-depth while preserving the RPC-only worker authority model.
6. Document incident response, credential rotation, rollback, containment, and recovery procedures.
7. Perform release-engineering and final public-launch security review with explicit evidence and rollback gates.

Phase 9 should remain evidence-driven and TDD-first where code changes are involved. Prefer local/disposable validation before consuming GitHub Actions.

## Separate production worker acceptance

Code-complete is not production-enabled. Keep these false/absent until their own operational gates pass:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

Do not infer Phase 8 validation success or Phase 9 hardening work authorizes any production worker.

## UI isolation

PR #49 and all active Dashboard V5/UI branches remain separate. Do not edit, merge, replace, retarget, or deploy that stream from the non-UI hardening workstream.

Accessibility/responsive QA remains part of the separate UI stream once its visual implementation is stable.

## Branch cleanup

Delete merged backend branches only with a true remote delete-ref mutation. Never force-move a merged branch to simulate deletion. Preserve PR #49 and all active V5/UI branches.
