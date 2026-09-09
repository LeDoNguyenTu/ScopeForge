# ScopeForge Phase 9C Release State

Released: 2026-09-08 (Asia/Singapore)

## Release identity

- PR: #59 - `fix: harden Phase 9C database and RPC privileges`
- frozen candidate: `421dcb3b1a7a6243fdaac546f362653937254878`
- frozen candidate tree: `780be0767723abdaf4b7f67012050c836f15d736`
- candidate Vercel Preview: `dpl_HMm9qAXPTBpi1HKPTWxDbtYgTja6`, READY, `aliasError=null`
- candidate CI: #770, run `34207537302`, success
- squash merge: `0869767401011cd32dcd3e3b2976201461655e02`
- released tree: `ca68a0559af93fc3b2143fdec387b84e418bb141`
- post-merge main CI: #771, run `34227543168`, success
- exact production deployment: `dpl_CGFqqSx8qC1PVd6hRT6KT5WtQQ1N`
- deployment target: production
- deployment Git SHA: `0869767401011cd32dcd3e3b2976201461655e02`
- deployment state: READY
- production alias includes `scopeforge.dev`
- `aliasError=null`

## Released database hardening

Live ScopeForge Supabase project: `tdgpibrepzcvdivztkta`.

Applied migration history entry:

`20260908084554_phase_9c_function_acl_hardening`

Repository migration source:

`supabase/migrations/20260908170000_phase_9c_function_acl_hardening.sql`

Phase 9C removed unnecessary direct execution authority from 17 private trigger-only functions for `PUBLIC`, `anon`, `authenticated`, and `service_role` while preserving the two authenticated RLS helper interfaces:

- `private.is_workspace_member(uuid)`
- `private.has_workspace_role(uuid, public.workspace_role[])`

Verified live acceptance after the migration:

- target direct-execution violations: zero
- private worker-table ordinary-role privilege violations: zero
- public privileged RPC violations for `anon`/`authenticated`: zero
- missing or disabled target trigger bindings: zero
- relevant `SECURITY DEFINER` search-path failures: zero
- authenticated private-schema usage preserved
- authenticated RLS membership and role-helper evaluation passed

A PostgreSQL 17.6 rollback-only canary proved an existing trigger still fires after direct execute authority on its trigger function is revoked from the DML role. The canary transaction rolled back cleanly and left no disposable objects.

## Future function ACL guard

Live validation proved schema-scoped default privilege revocation does not override PostgreSQL's built-in `PUBLIC EXECUTE` default for future functions. A database-wide `postgres` default revoke was rejected because `postgres` also owns managed extension functions outside ScopeForge application schemas.

The durable control is therefore repository-level:

- every later migration that creates or replaces a `public` or `private` function must explicitly revoke function execution in that same migration
- intentionally callable functions then receive only the narrow explicit grant they need
- global `postgres` default-function revocation is rejected by architecture tests
- `supabase_admin` default privileges remain untouched

The already-deployed schema-local default ACL statements remain immutable migration history but are not treated as evidence that future functions are deny-by-default.

## Verification

Both the frozen candidate and merged production tree passed:

- npm audit
- full Vitest suite
- TypeScript typecheck
- CLI build and version check
- historical scanner benchmark
- Phase 8B benchmark matrix
- production Next.js build

Supabase Security Advisor after Phase 9C still reports exactly the pre-existing `auth_leaked_password_protection` warning. That is a Phase 9B provider-control item, not a Phase 9C regression.

## Production UI integration baseline

The production UI had advanced on `main` before Phase 9C merged. The immediate pre-merge production baseline was `86d342216cf05d2951fd9ed427d35b6d575e7765`. Phase 9C changed a disjoint backend/docs file set and was squash-merged on top of that UI baseline. The released `main` tree `ca68a0559af93fc3b2143fdec387b84e418bb141` therefore contains both the current production UI and Phase 9C hardening.

For all remaining Phase 9 work, the actual production `main` tree is authoritative. PR #49 remains an open draft legacy UI branch and must not be merged, rebased, retargeted, or used as the hardening baseline unless separately requested.

## Runtime boundary

Phase 9C authorizes no hosted scanner or worker runtime. Keep all four hosted capability flags false/absent until their independent operational gates pass.
