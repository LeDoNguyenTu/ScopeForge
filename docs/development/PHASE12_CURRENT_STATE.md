# Phase 12 current state

## 2026-10-30 acceptance checkpoint

Main advanced through owner-authorized PR #220 to
`7e62d103afbcf3561461cb2fe329d9cc214b4f08`, deployed READY as
`dpl_F8BZ15BQbDLcnmYZWB7qGLgsk3TF` on `scopeforge.dev`. Candidate CI
`41033282669` and main CI `41038513290` passed.
Issue #214 is closed and its harness is released in PR #220. Exact executable candidate
`fad381480dc1961e4e3fcc606112f37851354f9f` passed the controlled external HTTPS
fixture on the accepted Oracle host and all 44 focused Linux tests. Budget,
hostile-frame, cancellation, resource/scratch and cleanup gates passed; the
temporary fixture was deleted and all production worker services remained active.
See `../validation/post-v1/PHASE12_HOST_TUNNEL_ACCEPTANCE.md`.
Production root/admin redirect checks passed. No external provider is
operationally accepted or enabled. The next scope is a reviewed dedicated
worker/control-plane design. This checkpoint supersedes older unimplemented-harness
statements below; prior target-free runtime evidence remains valid.

Last reconciled: 2026-10-28, Asia/Bangkok. Live GitHub/provider state wins.

## Exact repository and release checkpoint

- GitHub repository and authenticated owner: `LeDoNguyenTu/ScopeForge` / `LeDoNguyenTu`.
- Exact released `main`: `a577739230a2b717caabfc28e8a33cad2a2e0c64` (merge of PR #218).
- PRs #216-#218: merged after owner-authorized administrative merges.
- Final main CI: run `40560380937`, success; candidate CI runs for all three PRs also passed.
- Vercel team/project: `itsbrian` / `prj_r7X4rdsjvwzp2tvuSA4D39gpITb8`.
- Main production deployment: `dpl_6eHQiN19RLYsXLFreRYxVFYh9UhR`, READY and serving `scopeforge.dev`.

Supabase connection `214nsa` now exposes the required ScopeForge project `tdgpibrepzcvdivztkta` in `ACTIVE_HEALTHY` state. The read-only control-plane snapshot below was refreshed on 2026-10-28. No database mutation was performed.

## Baseline

- Approved ScopeForge v1 roadmap: 100%.
- Phase 11 source/operational acceptance: 100%.
- Broader automated-pentest product vision: approximately 75% at Phase 12 start.
- Production external-provider execution remains disabled until each provider passes its own operational gate.

## 12A external ProjectDiscovery httpx

Source/runtime preparation is substantially complete and remains default-off. No Phase 12 provider is operationally accepted.

Released through PR #185:

- pinned ProjectDiscovery httpx v1.12.0 Linux artifact SHA-256 values
- closed `web.http.probe.v1` provider contract
- deterministic fixed argument profile
- dedicated worker runner/container entry
- digest-pinned Node container source
- target binding, output bounds, cancellation plumbing, hostile-output checks, privacy-reduced evidence
- worker bundle generation

Released target-bound containment foundations:

- PR #196: target policy and provider egress boundary
- PR #197: networkless provider egress tunnel
- PR #198: trusted egress sidecar and fixed provider proxy wiring
- PR #199: two-container provider sandbox orchestration
- PR #200: target-free Linux containment helper
- PR #211: deterministic target-free build, staging, preflight and evidence bundle

Remaining 12A gates (the pre-control-plane harness is tracked in issue #214):

1. preserve PR #218's merged target-free host corrections and the exact-source image/containment evidence already recorded
2. implement issue #214's real host-tunnel acceptance harness, with separately reviewed exact-target authorization required for successful external contact
3. prove pinned-IP dialing, hostile-frame rejection, connection/byte/deadline budgets and target TCP cleanup
4. prove process-tree cancellation and CPU/memory/PID/disk/runtime/output ceilings with the real provider process
5. register/enable a dedicated worker class only after the database/control-plane design is reviewed
6. run exact-head CI and a separately authorized bounded production canary
7. record rollback and cleanup evidence

No production httpx worker is currently enabled.

Host preparation shipped in PR #193 through `scripts/phase12-stage-provider-assets.sh` and `scripts/phase12-provider-host-preflight.sh`. PRs #196-#200 then released the provider-neutral target-bound egress boundary, host tunnel, trusted sidecar, two-container sandbox and target-free containment helper. PR #211 added `scripts/phase12-provider-containment-bundle.sh`, which is now the preferred first command on the accepted Linux/Oracle host because it deterministically builds, stages and preflights the immutable provider and sidecar images before invoking target-free containment evidence. It does not contact an external target and does not establish operational acceptance. See `PHASE12_PROVIDER_HOST_PREPARATION.md` and `PHASE12_TARGET_BOUND_EGRESS_DESIGN.md`.

## 12B Nuclei safe-active runtime

Source preparation is merged and remains default-off.

Pinned supply-chain identities:

- Nuclei engine v3.11.1
- engine commit `a8c88feb4a1c8e961b7902534ce3af97e9d524a4`
- Linux amd64 SHA-256 `ea63d4ae232808cd7c6bc00d0142428e231fab59dae01042246097d195835ab6`
- Linux arm64 SHA-256 `8044e3d9768ba0a744b2872c1a87e813006f013da97ca9f50f7661a4203bec07`
- nuclei-templates v10.4.7
- templates commit `83234ce456da3e90dda86dfbc5e605e64a846df3`

The first runtime allowlist contains exactly one reviewed non-destructive template:

- `http-missing-security-headers`
- source path `http/misconfiguration/http-missing-security-headers.yaml`
- pinned Git blob `7c1c5b8191ddf3468348b8f8a046b4d61b75d319`
- upstream metadata declares one request

The runtime profile:

- accepts only the exact trusted host/scheme/port
- disables redirects, OAST/interactsh, internal httpx probing and update checks
- uses one template, one host, one request-per-second rate, bulk/concurrency/payload concurrency of one
- omits raw request/response and embedded template material from JSONL output
- normalizes only bounded template/severity/matcher/timestamp evidence
- keeps the more aggressive `misconfiguration-reviewed` and `known-cve-reviewed` profiles disabled

This is source preparation only. No Nuclei production execution is authorized by these files.

The same host preparation helpers stage the pinned Nuclei engine and exact allowlisted template with archive SHA-256 and template Git-blob verification before building a networkless image candidate. Nuclei is intended to reuse the same provider-neutral target-bound egress boundary as httpx, with its one-template allowlist unchanged.

## Storage state

Production Supabase database size observed at Phase 12 start: approximately 18 MB.

Supabase Storage objects: 0.

Production repository snapshot metadata records five R2-backed snapshots. R2 is the large/unstructured artifact plane; Postgres remains the structured system of record.

Phase 12 should continue moving large raw provider evidence/artifacts to private R2 rather than growing Postgres with blob-like payloads.


## Released containment preparation through PR #211

PR #198 merged as `c9b6509506f2a12f8848ddcab5f4ee5eebe19c15` after exact-head CI run `35919874883` passed. It added the dedicated trusted egress sidecar image/entry, separate no-download sidecar staging, fixed internal proxy arguments for httpx and Nuclei, and extended networkless image preflight. Both providers remain default-off.

PR #199 merged as `a75ff01bc1f6ab7b5214bb8b90eba56b6f9b0bf0` after exact-head CI run `35935363334` passed the full validation gate. The merged provider sandbox gives the egress Unix socket and task nonce only to the networkless trusted sidecar; the provider joins only that sidecar's network namespace and receives neither. Runner arguments are constructed from closed typed httpx/Nuclei profiles rather than an arbitrary flag list. No worker identity, queue route, migration or production enablement was added.

PR #200 merged as `c9ae240224356a4ef81950014891a9b696a5fa8b` after exact-head CI run `35936024843` passed the full validation gate. The target-free Linux containment helper is now released at `scripts/phase12-provider-linux-containment.sh`. It requires a clean exact source SHA, rootless Podman, cgroup v2, and local immutable provider/sidecar image digests. It is designed to prove direct DNS/public TCP/metadata access are blocked, the fixed loopback proxy is reachable, the provider cannot see the task Unix socket or container-engine sockets, and the provider shares only the trusted sidecar network namespace. It does not run httpx/Nuclei scanning or contact a production target.

PR #211 merged as `9324dd177bd75b060b197416f3025eb10d28c194`. Its target-free coordinator `scripts/phase12-provider-containment-bundle.sh` builds and stages the exact provider/sidecar candidates, validates host commands, runs preflight and produces the target-free containment evidence bundle. Exact-main CI run `36074135221` passed and exact-main Vercel deployment `dpl_3woeXP9VsmezyAoXgKMfpeneKNHs` is READY.

Operational state remains unchanged until this helper is run successfully on the dedicated Linux/Oracle worker host and the remaining host-tunnel/cancellation/budget acceptance gates pass. 12A and 12B are not operationally accepted.


### Last verified control-plane snapshot (2026-10-28)

- Registered worker classes are `phase11_http_discovery_v1`, `phase3_repository_scan_no_egress_v1`, and `repository_snapshot_github_private_v1`; there is no registered Phase 12 provider worker.
- Phase 11 HTTP tasks are 2 completed and 3 preserved dead-letter, with no queued, leased or retry-wait Phase 11 HTTP task.
- One unrelated public repository snapshot task remains queued and is intentionally untouched.
- The private schema grants no direct table privileges to `anon` or `authenticated`. The historical nine-table RLS advisor snapshot was not refreshed during this read-only checkpoint; any RLS change remains a separately reviewed migration.


### Current acceptance gap

Target-free httpx containment passed on the dedicated Oracle host for PR #218's exact runtime candidate `8472f33c9c2ad04b29e436b07b551ac8ed062ae2`, after correcting file modes and fitting readiness/DNS work within the original PID ceiling. Post-run checks found zero acceptance containers and zero egress sockets; all three accepted worker services remained active. The next source/runtime slice is issue #214: one deterministic acceptance harness composing the existing host tunnel and two-container sandbox to prove pinned-IP dialing, hostile-frame rejection, connection/byte/runtime budgets, cancellation, resource ceilings and idempotent cleanup. No worker registration, queue route, migration, production target authority or canary belongs in that slice. This target-free evidence does not operationally accept httpx or Nuclei.


## Frontend/runtime visibility continuation

Phase 12 now treats frontend parity as part of product completion rather than optional presentation work.

PR #202 merged the initial frontend/runtime visibility as `86c20e8c9a440f9d604a180db82288d8cc18608d`. PRs #205-#209 then released the product polish, dashboard/public security-engine surfaces and mobile active-item positioning. The released product includes:

- workspace `/dashboard/security-runs` using the existing RLS-safe run summary read model
- per-run `/dashboard/security-runs/[runId]` for action state, coverage, graph counts and normalized observations
- platform-admin `/admin/providers` showing operational versus validation-only providers and each acceptance gate
- a single provider-readiness presentation model derived from the actual provider identifiers/versions
- navigation and dashboard next-action integration
- preview-only `/preview/security-runs` and `/preview/admin?view=providers` surfaces
- mobile/desktop overflow and browser-smoke coverage

The UI intentionally provides no provider enable button. httpx and Nuclei remain visibly disabled until their Linux containment, worker/control-plane and production canary gates actually pass.


These surfaces are merged and deployed. Issue #213's mobile navigation correction is released through PR #217 and verified with authenticated production rendering and keyboard focus checks. Issue #212's expected unauthenticated admin redirect telemetry correction is released through PR #216 and verified in production. Both issues are closed.

## Conservative completion estimate

- Approved v1 roadmap: 100% (11 of 11 phases).
- Phase 11 source and operational acceptance: 100%.
- Broader automated-pentest product vision: retain the approximately 75% Phase 12-start estimate until the roadmap is re-estimated from accepted capabilities.
- Phase 12 provider operational acceptance: 0 providers accepted; httpx and Nuclei remain default-off.
- Phase 12 source preparation: substantial, but not assigned a completion percentage because the real Linux host-tunnel acceptance, control-plane design and bounded production canaries have not occurred.
