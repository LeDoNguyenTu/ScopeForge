# ScopeForge Current State

Last reconciled: 2026-09-18, Asia/Singapore.

## Current Phase 10A3 checkpoint

- `main`: `327b06d150f24d4cb3161cac078198ae0d473613`.
- Issue #79: CLOSED; PR #76: MERGED/released.
- PR #77: OPEN/DRAFT, cleanly mergeable; source head `1fd0a5472d8dbdb4359992de96f1ad494f72df24`.
- Exact source validation and the final 24-file security scan are green; security scan ID `3d751254-8c97-4b99-b464-a97955b7839d` has zero findings.
- All seven Phase 10A3 migrations are deployed to `tdgpibrepzcvdivztkta`. Privileged functions are `service_role` only with empty search paths; private reconciliation tables have RLS enabled and no DML grants to browser or service roles.
- Production Vercel has the new webhook secret. The GitHub App webhook still needs the matching secret and `https://scopeforge.dev/api/integrations/github/webhook` URL before canaries or merge.
- Production deployment `dpl_Cyn83SBDv8C2X6fKFLiikK5DncuA` is READY at `scopeforge.dev`. Signed ping/unsupported-event and invalid-signature/oversize edge canaries passed with statuses `200/202/401/413`.
- PR #77 is ready and CI run `35257055269` passed at `657359bc44a5376205f8a449f1b4cae9cc2b3fa4`. A final documentation-only CI run is expected after this checkpoint commit.
- Existing advisor backlog remains: reviewed collaborator SECURITY DEFINER RPCs, leaked-password protection, and measured foreign-key/index performance follow-up.

Older queue details below are historical and must not override this checkpoint.

## Release queue

- `main`: `1b23dc8e5aa4c130d7ff6174cbf9444879b88bae` at reconciliation.
- Issue #79: CLOSED.
- PR #76: OPEN/DRAFT, mergeable/clean; executable head `e8d47e4a42ac97b3eabfb41a884555fe24ef93ec`.
- PR #77: OPEN/DRAFT at `1fcad5ff876cdfc2dba948213f987c2d5af2ae7a`; reconcile after #76.
- PR #124: docs-only Phase 11 plan.

Release order: final #76 CI -> merge/release #76 -> reconcile/accept #77.

## Phase 10A2 production

- Supabase: `tdgpibrepzcvdivztkta`.
- All five Phase 10A2 migrations are applied through `20260917065241`.
- Three repository gates are enabled after acceptance.
- Two workers are enabled; zero tasks are active.
- Both services are active; no containers or task directories remain.
- Vercel `dpl_B3sfM7kVZubuBqGBkw3WtB4wJMk1` is READY.

The private canary at `d95ca07123e28ee64de799e87651c2a3b6edb5cf` completed the real archive -> immutable snapshot -> zero-egress scan -> finding flow. Run `024e283b-353c-485d-b3ed-36f4e68bc1f7` produced one high/high CWE-78 finding with zero scanner errors. The finding list and detail page are browser-verified.

Security Advisor has no new Phase 10A2 authorization defect. The remaining notices are documented non-blockers.

The main worktree has user-owned `AGENTS.md`, `CLAUDE.md`, and `.claude/` changes. Preserve them.
