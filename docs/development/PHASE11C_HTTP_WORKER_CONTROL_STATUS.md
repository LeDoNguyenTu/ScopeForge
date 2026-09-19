# Phase 11C HTTP worker control status

Last reconciled: 2026-09-19, Asia/Singapore. Live repository/provider state wins if newer.

## Released

- PR #141: hardened provider contracts.
- PR #142: bounded first-party HTTP discovery mediator/runtime foundation.
- PR #143: trusted Phase 11C HTTP worker control.
- PR #144: reproducible runtime image source and worker-bundle CI gate.
- PR #145: result-to-coverage reconciliation.
- PR #146: exact-image Linux containment acceptance record.
- PR #147: explicit worker-host configuration for `phase11_http_discovery_v1`.
- PR #147 exact-head CI run `35409821247` passed before merge.

## Implemented control boundary

The released implementation includes:

- claimed worker input limited to immutable run/action/authorization identifiers
- privacy-reduced terminal result validation
- closed HTTP discovery failure-code set
- run/action/snapshot/target/capability/provider identity revalidation
- authorization expiry and target-scope revalidation
- exact closed parameter validation
- HTTPS/443 target canonicalization in trusted code
- request/runtime budget checks and clamping
- replay-safe enqueue keyed by the version-bound authorization ID
- opaque queue references and trusted cancellation
- immutable private worker-task binding
- service-role-only enqueue, claim, preparation-context, cancellation, and finalization RPCs
- claim-time authoritative revalidation
- authenticated internal prepare/finalize routes
- terminal replay protection and cancellation-race handling
- privacy-reduced observation normalization
- atomic action-attempt/final result persistence
- request accounting that fails safe under ambiguous failure/cancellation
- result-to-coverage reconciliation and deterministic stop ceilings
- generic worker parser/supervisor integration only for the exact reviewed execution class
- single-use Unix mediator and `--network=none` runtime sandbox
- explicit worker-host configuration requiring an absolute Podman path and immutable runtime-image digest

## Live production state

- Supabase `tdgpibrepzcvdivztkta` is ACTIVE_HEALTHY.
- The reviewed Phase 11A/11C migrations are already present in the live migration history.
- Checked Phase 11 worker RPC ACLs grant execute to `service_role` only.
- One `phase11_http_discovery_v1` worker identity is already registered for current `main`.
- The worker has not heartbeated yet.
- There are zero Phase 11 HTTP worker tasks.
- Vercel production is READY on current `main` and had no runtime errors in the latest 24-hour check.
- `scopeforge.dev` returns HTTP 200 with the expected nonce-based CSP/security headers.

## Remaining release gate

1. on the dedicated Oracle host, install/use only the accepted immutable runtime image
2. configure/start the existing registered worker identity
3. prove authenticated idle claim/heartbeat
4. exercise class-scoped rollback
5. run one bounded authorized production canary
6. verify request accounting, result-to-coverage reconciliation, cancellation/recovery, terminal cleanup, and logs
7. leave the class enabled only after the canary and rollback checks pass

## Hard boundaries

- No browser/user-controlled URL, method, headers, body, argv, network policy, worker budget, or direct target authority.
- Do not reapply already-present Phase 11 migrations.
- Preserve service-role-only worker RPC ACLs.
- Preserve the accepted immutable runtime image digest and `--network=none` sandbox.
- No external Nmap, Nuclei, or external httpx process runner is enabled.

## Security-advisor note

Supabase flags RLS-disabled private worker tables. Direct privilege checks on the inspected worker tables show no `anon` or `authenticated` table SELECT grant, while the Phase 11 control RPCs remain service-role only. Do not auto-enable RLS without a separately tested policy design because enabling it without policies would block trusted worker access.

The public workspace collaborator `SECURITY DEFINER` RPCs are intentionally authenticated endpoints and perform explicit `auth.uid()`, live-account, and owner/admin authorization checks before reading or mutating collaborator state.
