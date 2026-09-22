# Worker RLS hardening experiment result

Date: 2026-09-22, Asia/Singapore.

## Purpose

Determine whether enabling row-level security on ScopeForge's nine private worker/runtime tables would materially strengthen the current production boundary, without paying for a Supabase development branch or changing production.

## Production facts verified read-only

ScopeForge Supabase project: `tdgpibrepzcvdivztkta`.

Role attributes:

- `postgres`: `rolsuper = false`, `rolbypassrls = true`
- `service_role`: `rolsuper = false`, `rolbypassrls = true`
- `anon`: `rolbypassrls = false`
- `authenticated`: `rolbypassrls = false`
- `authenticator`: `rolbypassrls = false`

Trusted worker/runtime routine surface:

- 57 inspected `SECURITY DEFINER` routines reference the nine worker/runtime tables
- all 57 are owned by `postgres`
- all 57 pin an empty `search_path`
- `anon` execute grants across those routines: 0
- `authenticated` execute grants across those routines: 0
- 9 private helper routines have no `service_role` execute grant
- 47 of the 48 public trusted routines are executable by `service_role`
- the one public non-service entry point is the internal `recover_expired_worker_attempts_leased_only(timestamptz)` helper

Table boundary:

- all nine worker/runtime tables have zero direct `anon` table grants
- all nine worker/runtime tables have zero direct `authenticated` table grants
- `authenticated` has `USAGE` on schema `private`, but that does not grant table access
- `service_role` has no direct schema `private` usage in the inspected posture and reaches trusted operations through reviewed public RPC entry points

## Free CI experiment

Test:

`tests/database/worker-rls-hardening-experiment.test.ts`

The PGlite test models two equivalent security-definer RPC ownership patterns:

1. a `BYPASSRLS` owner matching current Supabase `postgres`
2. a dedicated non-`BYPASSRLS` owner

Corrected exact-head CI:

- workflow run: `35694652988`
- RLS experiment: 5/5 tests passed
- complete repository suite: 498 files passed
- complete repository tests: 2,304 passed
- typecheck: passed
- CLI and worker builds: passed
- scanner and Phase 11 benchmark suites: passed
- Next production build: passed
- CSP browser smoke: passed
- production V5/Turnstile diagnostic: passed

The initial run `35694414568` failed only because the synthetic function owners lacked `USAGE` on the synthetic `private` schema. Production `postgres` has the required schema authority. The harness was corrected to model that production fact before rerunning the same RLS assertions.

## What the experiment proves

### Current BYPASSRLS owner

With both:

- `ENABLE ROW LEVEL SECURITY`
- `FORCE ROW LEVEL SECURITY`

a security-definer RPC owned by a `BYPASSRLS` role still reads the protected table.

This matches the current production ownership model because all 57 inspected worker/runtime security-definer routines are owned by `postgres`, and production `postgres` has `BYPASSRLS`.

Therefore simply enabling or forcing RLS on the current tables would **not constrain the current trusted RPC path**.

### Dedicated non-BYPASSRLS owner

When the otherwise-equivalent security-definer RPC is owned by a role without `BYPASSRLS`:

- forced RLS with no policy yields no table rows to the RPC
- adding an explicit owner policy restores only the allowed access

This proves that RLS becomes a meaningful enforcement layer only after the trusted execution identity is moved away from a `BYPASSRLS` owner.

### Direct browser/service access

The experiment also confirms:

- browser roles without table grants cannot directly read the private table
- a caller role having `BYPASSRLS` does not itself grant table access when table privileges remain revoked
- the reviewed security-definer RPC can remain the controlled entry point

## Decision

Do **not** add a production migration that only enables or forces RLS on the nine current `postgres`-owned worker/runtime tables. That would largely satisfy an advisor signal without materially constraining the existing trusted RPC owner.

Keep the current zero-browser-grant boundary through Phase 11 closure.

If stronger defense in depth is pursued afterward, make it a dedicated architecture slice:

1. create a narrowly scoped non-`BYPASSRLS` worker RPC owner role
2. move only reviewed RPC ownership/required table authority to that role
3. enable/force RLS on one table family at a time
4. create explicit least-privilege policies for the dedicated owner
5. preserve empty `search_path`
6. keep `anon` and `authenticated` table/RPC authority at zero
7. run claim, heartbeat, finalization, cancellation, recovery, snapshot, scan, publication, and cleanup integration tests
8. include forward and rollback migrations
9. deploy only after Phase 11 operational acceptance, followed by a bounded production regression canary

No production database mutation was made by this experiment.
