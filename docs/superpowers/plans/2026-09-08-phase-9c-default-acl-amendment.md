# Phase 9C Default ACL Strategy Correction Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to apply this correction inside the existing Phase 9C implementation stream.

**Goal:** Correct the future-function hardening mechanism after live PostgreSQL acceptance proved schema-scoped default revokes cannot override the hard-wired `PUBLIC EXECUTE` function default.

**Architecture:** Keep the already-applied ACL reduction for the 17 existing trigger-only functions. Do not apply a global `postgres` default privilege mutation because live ownership inventory shows `postgres` also owns managed extension functions. Enforce future application function ACLs through a permanent migration architecture test instead.

**Spec amendment:** `docs/superpowers/specs/2026-09-08-phase-9c-default-acl-amendment.md`

## Constraints

- Never rewrite `supabase/migrations/20260908170000_phase_9c_function_acl_hardening.sql`; it is already applied to production migration history.
- Do not add a compensating migration merely to modify schema-local default ACL rows that do not solve the global hard-wired default.
- Do not execute global `ALTER DEFAULT PRIVILEGES FOR ROLE postgres ... REVOKE EXECUTE ... FROM PUBLIC`.
- Do not alter `supabase_admin` defaults.
- Do not touch extension, storage, auth, realtime, GraphQL, UI, runtime, provider, or legacy table-grant boundaries.

### Task 1: Replace the false static default-ACL assertion

- [x] Update `tests/architecture/phase-9c-database-rpc-hardening.test.ts` so it no longer claims schema-scoped revocation makes future functions deny-by-default.
- [x] Add a guard rejecting database-wide `postgres` default-function revocation and any `supabase_admin` default change.
- [x] Add a migration scanner requiring every SQL migration after `20260908170000_phase_9c_function_acl_hardening.sql` that creates a `public` or `private` function to include an explicit same-migration function revoke.
- [x] Commit as `test: enforce explicit future function ACLs [skip ci]`.

### Task 2: Record the corrected design

- [x] Add `docs/superpowers/specs/2026-09-08-phase-9c-default-acl-amendment.md` describing the PostgreSQL semantic, live blast-radius evidence, rejected global fix, and repository-level replacement control.
- [x] State explicitly that the already-applied schema-local default ACL statements are not release evidence for future-function denial.

### Task 3: Re-run live acceptance under the corrected criteria

- [ ] Prove all 17 existing target functions remain non-executable by `PUBLIC`, `anon`, `authenticated`, and `service_role`.
- [ ] Prove both authenticated RLS helpers still execute and `authenticated` still has private-schema usage.
- [ ] Prove private worker tables remain closed to ordinary roles.
- [ ] Prove public privileged worker/control RPCs remain closed to `anon` and `authenticated`.
- [ ] Prove all target trigger bindings remain enabled.
- [ ] Prove all relevant `SECURITY DEFINER` functions keep `search_path=""`.
- [ ] Run a real authenticated-role RLS query using an existing membership without returning identifying data.
- [ ] Run Supabase Security Advisor and record the separate leaked-password warning honestly.

### Task 4: Resume the original Phase 9C release plan

- [ ] Reconcile the actual Supabase migration-history version.
- [ ] Update the Phase 9 working and session handoff docs with the canary, migration, corrected default-ACL strategy, and live acceptance.
- [ ] Verify branch scope and exact-head Vercel Preview.
- [ ] Freeze one candidate, run one substantive CI validation, review exact head/base/status, squash merge, and independently verify main CI plus production Vercel deployment.
- [ ] Write the final docs-only Phase 9C release checkpoint and verify it creates no redundant Actions run.
