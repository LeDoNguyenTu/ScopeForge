# Phase 11C Production Enablement Runbook

Last reconciled: 2026-09-21, Asia/Singapore.

This runbook covers the remaining operational release gate for `phase11_http_discovery_v1`.

It assumes:

- source implementation PR #147 is released
- reviewed Phase 11A/11C migrations are already present in production
- the production Phase 11 worker identity is already registered
- exact-image Linux containment acceptance has passed
- the dedicated Oracle Linux host is the only machine authorized to run this worker class

Do not use this runbook to create broader target authority, enable an external scanner process, or bypass the Phase 11 authorization model.

## Immutable release inputs

Control origin:

`https://scopeforge.dev`

Execution class:

`phase11_http_discovery_v1`

Accepted runtime image:

`localhost/scopeforge-runtime-worker@sha256:dd3014df27dd6d560b78ed6bdab9081a7da3648604dfdc44c6b35f9246de1c2a`

Runtime bundle SHA-256:

`05dd6f00bb5a1bf9be6b8046d3c7aeff79b4b78a7b73dba5d72acb095cee8153`

The long-running supervisor bundle is built from current released source with:

`npm run build:workers`

and is:

`.scopeforge-worker-build/scopeforge-worker.cjs`

## Before touching the worker host

Confirm from provider state:

- Vercel production is READY on released `main`
- `scopeforge.dev` returns 200
- Supabase project `tdgpibrepzcvdivztkta` is ACTIVE_HEALTHY
- Phase 11A/11C migrations are already present
- exactly the intended Phase 11 worker identity is registered
- its existing credential is available from secure host secret storage
- there are zero unexpected Phase 11 tasks

Do not rotate/re-register the worker identity merely because the database stores only the credential hash. If the original secret is unavailable, stop and perform an explicit credential-rotation procedure that disables the stale identity before creating a replacement.

## Required host environment

Keep these values only on the dedicated worker host. Never copy the worker credential into Vercel, client code, logs, shell history, or the repository.

```text
SCOPEFORGE_WORKER_BASE_URL=https://scopeforge.dev
SCOPEFORGE_WORKER_ID=<existing registered worker UUID>
SCOPEFORGE_WORKER_SECRET=<existing 64-hex worker credential>
SCOPEFORGE_WORKER_EXECUTION_CLASS=phase11_http_discovery_v1
SCOPEFORGE_WORKER_POLL_MS=2000
SCOPEFORGE_PODMAN_BINARY=/usr/bin/podman
SCOPEFORGE_RUNTIME_IMAGE=localhost/scopeforge-runtime-worker@sha256:dd3014df27dd6d560b78ed6bdab9081a7da3648604dfdc44c6b35f9246de1c2a
```

The runtime rejects a non-HTTPS control origin, malformed worker identity/credential, unsupported execution class, non-absolute Podman path, or mutable image reference.

## Host preflight

Run as the dedicated unprivileged worker account.

Confirm:

```sh
test "$(id -u)" -ne 0
test -x /usr/bin/podman
/usr/bin/podman info
/usr/bin/podman image exists 'localhost/scopeforge-runtime-worker@sha256:dd3014df27dd6d560b78ed6bdab9081a7da3648604dfdc44c6b35f9246de1c2a'
test -f .scopeforge-worker-build/scopeforge-worker.cjs
```

The host must still be rootless Podman on cgroup v2. Do not relax the accepted container boundary to make startup easier.

The supervisor mediator socket is created under `/run/scopeforge-worker/mediator`, inside the systemd-owned `RuntimeDirectory=scopeforge-worker`. This shorter root keeps the complete 64-hex filename within Linux's pathname Unix-socket limit. The host-side socket root must never point at `/run/scopeforge/runtime-mediator`, which is outside the service's declared writable paths under `ProtectSystem=strict`.

## Idle authentication proof

Start only the long-running supervisor:

```sh
node .scopeforge-worker-build/scopeforge-worker.cjs
```

Expected first log:

```json
{"event":"worker_runtime_started","executionClass":"phase11_http_discovery_v1"}
```

With no queued Phase 11 task, the worker should repeatedly authenticate and claim nothing. It must not start the runtime container during an idle proof.

An idle claim authenticates the worker but does not update `last_seen_at`; that column advances only after a task lease/heartbeat. Prove idle authentication with a direct authenticated claim that returns the exact empty result while:

- no Phase 11 task is created
- no Phase 11 action changes state
- no runtime container remains
- no mediator socket remains
- no credential, authorization token, URL credential, response body, or unrestricted header map appears in logs

If authentication fails, stop the worker. Do not loosen worker RPC ACLs or bypass credential validation.

## Class-scoped rollback proof

Before the canary, prove rollback without affecting Phase 6/10 workers:

1. stop the Phase 11 worker supervisor
2. confirm only the Phase 11 worker stops
3. confirm existing repository snapshot/scan workers remain healthy
4. confirm no Phase 11 runtime container or mediator socket remains
5. restart the Phase 11 worker with the same immutable configuration
6. repeat the authenticated empty-claim proof after restart

Do not disable shared worker infrastructure to prove a Phase 11 rollback.

## Bounded production canary

Use a target owned/controlled for ScopeForge acceptance and an authorization snapshot that contains only that intended HTTPS target.

Canary constraints:

- one Phase 11 run
- one authorized target node
- safe-active HTTP capability only
- closed request parameters only
- request ceiling no greater than the reviewed capability ceiling
- total runtime no greater than 30 seconds
- no intrusive/validation capability
- no external Nmap, Nuclei, or external httpx process
- no unrelated target or redirect authority

The canary must travel through the normal Phase 11 planner/policy/authorization/queue path. Do not insert a worker task manually to simulate success.

Use the platform-admin `Phase 11` control after the release containing that page reaches production. It accepts only an existing verified HTTPS web/API asset in a workspace where the signed-in operator is an owner/admin. The server fixes the capability to `web.http.probe.v1`, root-only `GET`, redirects disabled, one request, and a five-second runtime ceiling.

## Canary acceptance evidence

Record all of the following:

- run ID and authorization snapshot reference
- action ID and capability/version
- target node ID
- worker task/attempt identity
- outcome
- exact request count
- observation IDs/evidence references
- coverage request-count delta
- provider-failure delta
- graph-expansion delta
- public summary state
- cancellation/recovery behavior if exercised
- worker `last_seen_at`
- terminal task/action state
- no remaining container
- no remaining mediator socket
- no secrets or response bodies in logs

A succeeded or no-signal result is acceptable if accounting and evidence semantics are correct. Do not manufacture a finding to make the canary look successful.

The released worker finalizer must also invoke the trusted run orchestrator after terminal persistence. This invocation is retry-safe: an exact terminal replay repeats only the idempotent parent-run advancement, while terminal evidence and accounting remain single-write. For the one-request canary, the follow-up advance should stop the run at the exhausted request budget.

## Failure response

If any of these occur, stop the Phase 11 worker and keep the class disabled:

- worker authentication mismatch
- unexpected target or redirect authority
- direct executor egress
- request/runtime budget violation
- observation scope mismatch
- request accounting rollback/undercount
- duplicate terminal accounting
- cleanup failure
- credential or sensitive payload leakage
- cancellation/recovery inconsistency

Preserve the failed run/task evidence for diagnosis. Do not delete or rewrite audit evidence to retry.

## Database/security notes

The checked Phase 11 worker-control RPCs are executable by `service_role` only.

Supabase Security Advisor currently flags RLS-disabled private worker tables. Direct privilege checks showed no `anon` or `authenticated` SELECT grant on the inspected worker tables. Do not auto-enable RLS without a separately reviewed policy migration because enabling RLS without policies would break trusted worker access.

The public workspace collaborator `SECURITY DEFINER` RPC warnings are unrelated to this release. Their source derives the actor from `auth.uid()` and enforces owner/admin workspace authorization.

## Completion criteria

Phase 11C hosted HTTP discovery can be considered operationally released only after:

- idle worker authentication is proven
- class-scoped rollback is proven
- one bounded authorized canary completes through the normal control path
- accounting and public/private state reconcile correctly
- cleanup and log-leakage checks pass
- the accepted immutable image remains unchanged

External Nmap, Nuclei, and external httpx process execution remains a separate future gate.
