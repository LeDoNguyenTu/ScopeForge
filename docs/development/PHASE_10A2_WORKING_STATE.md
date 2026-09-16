# Phase 10A2 Private Repository Acquisition Working State

## Live candidate and acceptance evidence (2026-09-17)

- PR #76 executable head: `2a612c4daa3e552ac4ba48f1f05f77bdf46e52bb`
- worker/scanner artifact candidate: `aace5fb954539460b940467fd85994d45dd7af65`
- production-target Vercel deployment: `dpl_21qMnEpBWxaatm95b9yu8Pg7uxJF`, READY and promoted to `scopeforge.dev`
- exact local validation: 422/426 test files passed with 4 skipped; 1,854/1,878 tests passed with 24 skipped; audit/typecheck/CLI/workers/benchmarks/Next build passed
- host: Oracle `168.107.81.228`, Node 24.16.0, rootless Podman, cgroup v2, dedicated worker account
- scanner image: `localhost/scopeforge-scanner@sha256:07be9bee8d3a0803a107042de8ea3ca2ab41b5496aa28e21d9ea0e42bcdc76ce`
- host-only scanner canary: expected `jsts/command-injection` / CWE-78, one finding, zero scanner errors
- private snapshot worker: `96823db9-b35f-4bde-a857-0b9b97d761de`
- repository scan worker: `e12db837-8e21-4dde-af92-984431fe3a89`
- both services active with runtime gates off; credentials remain root-owned mode-0600 on host

Provider authorization is the immediate gate. The installation edit form has both repositories selected locally, but Save has not been submitted. Do not claim provider access until the saved settings page and provider API behavior verify it.

Last reconciled: 2026-09-16, Asia/Singapore

Phase 10A2 implementation is code-complete enough for release acceptance but remains deliberately unreleased. PR #76 must stay draft until dedicated worker/runtime/private-flow acceptance succeeds.

## Candidate

Pre-documentation executable head:

`4ef285473402336b4488af4e1c2b4b1ea28d5eb7`

Evidence:

- current-main checkpoint: `1b23dc8e5aa4c130d7ff6174cbf9444879b88bae`
- candidate was 159 commits ahead / 0 behind that main checkpoint
- exact CI: `35102938452`, success
- exact Vercel preview: `dpl_Cgt5cBd5guXKvVEfRDJS8fEXKENE`, READY
- issue #79: CLOSED after both authenticated negative authorization canaries

## Production schema

ScopeForge Supabase project: `tdgpibrepzcvdivztkta`.

Applied Phase 10A2 migrations:

- `20260916122505 phase_10a2_private_repository_snapshot`
- `20260916122512 phase_10a2_private_project_scan_routing`

Verified live:

- GitHub repository link is bound into private snapshot task state with workspace-aware FK and `ON DELETE RESTRICT`
- lookup index exists
- worker/task execution classes include private snapshot and zero-egress repository scan
- private orchestration tables have no direct DML access for `anon`, `authenticated`, or `service_role`
- public registration/enqueue/finalization wrappers are limited to service-role where intended
- private claim/finalize helpers are not directly exposed to browser/service roles
- current Phase 10A2 worker nodes = 0
- current Phase 10A2 worker tasks = 0

Security Advisor has no new Phase 10A2 release-blocking authorization finding. Existing collaborator SECURITY DEFINER warnings are intentional PR #118 authenticated RPCs with internal owner/admin authorization. Performance findings are INFO-level and deferred from this security release candidate.

## Private canary

Use only:

`LeDoNguyenTu/scopeforge-private-canary`

Fixture head:

`d95ca07123e28ee64de799e87651c2a3b6edb5cf`

The fixture is inert source for static analysis, not executable acceptance code. It matches the supported Express request-input -> `child_process.exec` path and should yield a high-confidence `jsts/command-injection` / CWE-78 finding.

The current GitHub connection uses `repository_selection = selected`. There is no verified evidence yet that the private canary is included in that provider-side selection. Add it through the legitimate GitHub App owner/admin settings flow; do not update database rows to simulate provider authority.

## Runtime/host boundary

Historical accepted host:

- Oracle VM: `168.107.81.228`
- SSH user: `ubuntu`
- Ubuntu 24.04 / rootless Podman / cgroup v2 historical Phase 6D acceptance
- prior access used OCI Cloud Shell and the owner's private SSH key

Fresh current-session result: TCP/22 on the public IP refuses connections. This ChatGPT session has neither the private key nor an OCI control surface. A connected authorized terminal is required for the host work.

Historical Phase 6D acceptance does not authorize Phase 10A2 runtime enablement because the worker bundle, Node target, systemd unit, scanner image, task classes, and private-source flow have changed.

## Acceptance sequence

1. regain authorized host access
2. fetch exact live #76 candidate and re-evaluate if executable SHA changed
3. validate host prerequisites for the current Node 24/systemd/rootless-Podman design
4. build/deploy worker bundle and pinned scanner image from exact candidate
5. generate worker credentials on host only; store mode-0600
6. register private snapshot + scan worker hashes/identities
7. verify authenticated idle claims/heartbeats with repository gates disabled
8. legitimately add the private canary to the ScopeForge GitHub App selected repositories
9. enable only Phase 10A2 repository gates for a bounded canary window
10. connect/import the private repo through the real app flow
11. prove provider revalidation -> private archive lease -> immutable snapshot -> exact zero-egress scan -> expected finding
12. prove cleanup, cancellation, quotas, privacy-reduced logs, credential isolation, provenance, and rollback
13. if any step fails, disable gates and keep #76 draft
14. if all steps pass, mark #76 ready, merge expected head, verify main CI and exact production deployment

## Permanent boundaries

- provider credentials remain control-plane-only
- worker contracts never contain GitHub installation tokens, OAuth/client secrets, private keys, workspace/user provider credentials, or long-lived object-store authority
- private source is hostile data and is never executed
- scan executor remains zero-egress
- no fabricated repository link/worker/task/finding may substitute for a real production canary
- Phase 10A3 stays blocked until #76 releases
