# ScopeForge Current State

Last reconciled: 2026-09-18, Asia/Singapore. Live provider state wins.

## Released baseline

- `main`: `aaada713296ec70f0a6497b4828939bc6b88e7fb`.
- PR #134 released labeled Phase 11 Task 11 evaluation coverage after PR #130's two-stage fixture and PR #132's evaluation matrix.
- Exact-head CI `35351118308`, post-merge main CI `35351673275`, and Vercel production deployment `6525534937` are successful for the released work.

## Task 11

The adaptive harness now has deterministic evidence-gated discovery, replay, cancellation, authorization-expiry, request-budget, provider-failure, labeled accuracy, duplicate-correlation, attack-path, remediation-retest, and local safety coverage. Its metrics are deliberately limited to committed synthetic fixtures.

## Production boundary

- ScopeForge Supabase: `tdgpibrepzcvdivztkta`.
- Phase 11 migrations remain unapplied and Phase 11 tables are absent in production.
- External Phase 11 provider execution is disabled.

## Next

Add deterministic graph-expansion and policy/approval fixture coverage before external provider evaluation. Do not repeat completed Phase 10 acceptance, apply Phase 11 schema early, or enable hosted providers.
