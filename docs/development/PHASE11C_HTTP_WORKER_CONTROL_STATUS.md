# Phase 11C HTTP worker control status

Last reconciled: 2026-09-20, Asia/Singapore. Live repository/provider state wins if newer.

## Released

- PR #141: hardened provider contracts.
- PR #142: bounded first-party HTTP discovery mediator/runtime foundation.
- PR #143: trusted Phase 11C HTTP worker control.
- PR #144: reproducible runtime image source and worker-bundle CI gate.
- PR #145: result-to-coverage reconciliation.
- PR #146: exact-image Linux containment acceptance record.
- PR #147: explicit worker-host configuration for `phase11_http_discovery_v1`.
- PR #159: systemd runtime-directory alignment for the mediator host socket.
- PR #163: Linux Unix-socket pathname-length correction.
- PR #164: post-claim `running` state accepted by trusted Phase 11 preparation.
- PR #164 exact-head CI run `35542030195` passed before merge.
- Current released main after PR #164: `3cc1443ed292a14fe6738bc64a0b8629b5992d56`.

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

- ScopeForge Supabase project remains `tdgpibrepzcvdivztkta`.
- The reviewed Phase 11A/11C migrations are already present in live migration history. Do not reapply them.
- Checked Phase 11 worker RPC ACLs remain service-role-only.
- Direct privilege inspection found zero `anon` or `authenticated` grants on the nine flagged private worker tables.
- One `phase11_http_discovery_v1` worker identity remains registered and enabled.
- The worker authenticated against the PR #164 production release with repeated idle claim HTTP 200 responses.
- Vercel deployment `dpl_8AYvooHJ38pJEk5yPfEe7o2JdiWe` is READY on exact main SHA `3cc1443ed292a14fe6738bc64a0b8629b5992d56`.
- There are no queued or leased Phase 11 tasks. Three failed canaries remain preserved as `dead_letter` evidence.
- The latest failed canary reached claim/finalization but preparation returned HTTP 409 because trusted preparation rejected the valid post-claim `running` action state. PR #164 is released to correct that exact state-machine defect.
- `scopeforge.dev` serves the released production deployment with the existing nonce-based CSP/security headers.

## Remaining release gate

1. Use an authenticated platform-admin session at `/admin/phase11`.
2. Run exactly one verified ScopeForge-owned HTTPS root-only `web.http.probe.v1` canary.
3. Confirm preparation succeeds past the previous HTTP 409 boundary and normal mediator/sandbox execution occurs.
4. Verify exactly one request, valid terminal run/action/task/attempt state, observation or legitimate no-signal result, and exact coverage reconciliation.
5. Verify ordinary logs/evidence do not expose response bodies, credentials, authorization tokens, or secrets.
6. Verify no leftover runtime container or mediator socket on the accepted Oracle host.
7. Record successful evidence, remove the temporary verification proof, and only then close Phase 11 operational acceptance.

## Hard boundaries

- No browser/user-controlled URL, method, headers, body, argv, network policy, worker budget, or direct target authority.
- Do not reapply already-present Phase 11 migrations.
- Preserve service-role-only worker RPC ACLs.
- Preserve the accepted immutable runtime image digest and `--network=none` sandbox.
- No external Nmap, Nuclei, or external httpx process runner is enabled.

## Security-advisor note

Supabase flags RLS-disabled private worker tables. Direct privilege checks on the inspected worker tables show no `anon` or `authenticated` table SELECT grant, while the Phase 11 control RPCs remain service-role only. Do not auto-enable RLS without a separately tested policy design because enabling it without policies would block trusted worker access.

The public workspace collaborator `SECURITY DEFINER` RPCs are intentionally authenticated endpoints and perform explicit `auth.uid()`, live-account, and owner/admin authorization checks before reading or mutating collaborator state.
