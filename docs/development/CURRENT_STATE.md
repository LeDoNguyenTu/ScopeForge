# ScopeForge Current State

## Product direction

ScopeForge is an open-source application-security and cyber-risk awareness platform built around:

`Discover -> Validate -> Explain -> Connect -> Prepare -> Fix -> Verify`

Authorization, deterministic evidence, explanation, remediation, and execution authority remain separate concerns. Security state must remain attributable to deterministic/runtime evidence or explicit human workflow rather than model inference alone.

## Completed foundations

- **Phase 1 Foundation** - identity, workspaces, RLS, application shell, security headers, and deployment baseline.
- **Phase 2 Asset control and authorization** - workspace-scoped assets, canonical targets, proof of control, SSRF-safe verification, roles, quotas, audit events, and asset UX.
- **Phase 3 Code and supply-chain security** - local/passive scanner, hostile-repository safety, secrets, JS/TS SAST, SCA/SBOM, IaC/configuration analysis, baselines, JSON/SARIF, golden outputs, and benchmarks.
- **Phase 4A Security domain contracts** - framework-independent finding/evidence/provenance contracts.
- **Phase 4B Verified passive runtime observations** - verified target policy, pinned HTTPS, bounded/redacted observations, and deterministic runtime findings.
- **Phase 4C-1 Bounded CORS origin-policy validation** - separately authorized, fixed-profile active validation.
- **Phase 5A Hosted finding foundation** - canonical hosted finding/evidence/history ledger.
- **Phase 5B Remediation, deterministic retest, and Security Story** - bounded human workflow and authoritative fresh-evidence retest semantics.
- **Phase 5C Hosted Phase 3 finding import** - privacy-reduced local/CI import without hosted repository execution.
- **Phase 6A Zero-egress worker foundation** - private PostgreSQL worker queue, scoped worker identity, exact leases, retries/recovery, cancellation-wins behavior, and provider-neutral supervision.
- **Phase 6B Public GitHub repository acquisition and immutable source snapshots** - merged through PR #38.
- **Phase 6C Isolated zero-egress Phase 3 scanning over immutable snapshots** - merged through PR #39 from exact verified head `d0b7c7a3a1de9d626478cf75cad5ee809f52dc3b` as merge commit `7a329dc2796a142102af2392ee461f205daa1b78`.
- **Deployment-readiness reconciliation** - merged through PR #40 as `415428ebc510a7a8e890d3a03ebc4ffb8194252a`.
- **Phase 6B public acquisition runtime gate** - merged through PR #41 as `07c6bc8580314b73c633a7b704e5f7557ceccb4d`.
- **Living Attack Surface WebGL dashboard v2 and browser identity refresh** - merged through PR #45 as application release commit `cde3a9437671d2151e1d4af120549d94b59d2ac3`.

## Production database

ScopeForge production Supabase project is:

`tdgpibrepzcvdivztkta`

Do not confuse it with any other Supabase project. Deployed migrations are immutable and all future schema corrections must use forward migrations.

Phase 6B repository snapshot authority remains separated from browser and generic service-role table mutation. Snapshot publication is dedicated-RPC-only, lease-bound, cancellation-first, and preserves immutable public provenance while keeping private object keys and artifact state outside browser-readable data.

Phase 6C extends the worker boundary with repository-scan-specific queue/publication state and exact immutable snapshot provenance. Scanner success is accepted only when the trusted result context matches the selected snapshot, repository identity, resolved commit, content digest, artifact digest, task, attempt, worker, and live lease. Generic finalization cannot publish repository-scan success.

The production Supabase security advisor was rechecked after the WebGL dashboard production deployment and reported zero security lints.

## Phase 6B repository acquisition boundary

The closed acquisition execution class is `repository_snapshot_github_public_v1`.

Repository identity derives only from the stored canonical repository asset. Callers cannot choose arbitrary URLs, branches, refs, commit SHAs, commands, package-manager configuration, execution budgets, or network policy.

Acquisition authority is limited to the reviewed GitHub API/codeload path and an attempt-specific private R2 upload. Archive parsing and normalization run without `git clone`, package execution, project hooks, submodule/LFS execution, or repository code execution. Public snapshot provenance is immutable and private artifacts are retained separately.

The public control plane now includes:

`HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED = false`

This gate is enforced server-side before privileged enqueue and reflected in the repository UI. A normal Vercel deployment therefore cannot enqueue repository snapshot tasks unless the separate acquisition worker/private artifact runtime is intentionally accepted and the capability is changed in reviewed code.

## Phase 6C zero-egress scanner boundary

Phase 6C consumes only a broker-selected immutable Phase 6B snapshot under a closed repository-scan execution class.

Security invariants include:

- no caller-selected snapshot, R2 object key, URL, branch, SHA, scanner list, command, image, environment, network policy, or execution budget
- no GitHub or R2 acquisition authority in the scanner executor
- repository source is data only
- no package lifecycle scripts, build commands, hooks, target project commands, nested runtime execution, or caller-provided executable configuration
- exact artifact byte count and SHA-256 verification before materialization
- path-safe and bounded snapshot reading/materialization
- fixed reviewed Phase 3 scanner profile
- bounded scanner result contracts
- artifact provenance checked by both supervisor and trusted publication paths
- cancellation and hard deadlines terminate underlying sandbox work
- repository success publication remains dedicated and exact-lease-bound

The repository contains the concrete rootless-Podman command/runtime adapter with fixed image/command, `--network=none`, read-only boundaries, capability dropping, non-root execution, and resource-limit arguments. This code alone is not production runtime acceptance evidence.

The public control plane keeps hosted scanning hard-disabled until real Linux rootless-Podman/cgroup-v2 acceptance is demonstrated. The server action rejects hosted scan requests before privileged enqueue while the runtime capability is false.

The production environment also keeps:

`HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED = false`

R2 credentials are therefore not required by the deployed web control plane.

## Exact Phase 6C verification

The final Phase 6C dependency lock is deterministic:

- SHA-256: `3bbc74fa07cf06b379058c741423974f30b46f5c4469694750e1b973fbccda7d`
- Git blob: `881bbdeedb0ee7a7cb8c171ca93b14f6e528d33d`
- 118,878 bytes
- 235 package entries
- Next 15.5.24
- PostCSS 8.5.26
- Sharp 0.35.3

Fresh verification on exact Phase 6C head `d0b7c7a3a1de9d626478cf75cad5ee809f52dc3b` passed:

- `npm ci`
- `npm run typecheck`
- 227 test files / 952 tests
- `npm run build:cli`
- CLI version `ScopeForge 0.1.0`
- scanner benchmark over 700 files with zero errors
- production Next.js build using ScopeForge public production configuration
- `npm audit` with zero vulnerabilities at every severity

The subsequent acquisition runtime gate was separately verified on exact head `f1e67a07250f194f315d5be1081b780f62da4f26`:

- focused gate tests 9/9
- full suite 227 files / 955 tests
- typecheck and CLI build/version
- scanner benchmark
- production Next.js build
- zero-vulnerability npm audit

## Living Attack Surface WebGL v2 verification

The reviewed UI release preserved the existing application-security authority boundaries and added no database migrations, RLS changes, hosted worker/runtime changes, network execution changes, or package dependencies.

Fresh final acceptance before merge passed:

- 234 test files / 977 tests
- `npm run typecheck`
- CLI build and version `ScopeForge 0.1.0`
- scanner benchmark over 700 files with zero errors, 728 ms wall time against a 20,000 ms budget
- `npm audit --audit-level=info` with zero vulnerabilities
- Next.js 15.5.24 production compilation and type validation

The bounded attack-surface model prioritizes risk-bearing assets when more than ten assets exist so a high-risk asset cannot be hidden merely because it was registered later. The raw-WebGL renderer has a DOM/CSS fallback, reduced-motion handling, visibility-aware animation, bounded device pixel ratio, and resize-driven canvas sizing to avoid per-frame layout reads on mobile Safari.

## Production deployment state

The ScopeForge web control plane is live in production while worker-backed repository acquisition and hosted scanning remain unavailable.

Stable production facts after the WebGL dashboard release:

- Vercel team: `team_WEcf1g1YcD6vYU8LD5jVUOKF`
- Vercel project: `scopeforge` / `prj_r7X4rdsjvwzp2tvuSA4D39gpITb8`
- framework: Next.js
- WebGL application release commit: `cde3a9437671d2151e1d4af120549d94b59d2ac3`
- production tracks `main`; later docs-only reconciliation commits may advance the production deployment SHA without changing application code
- production deployment state was verified `READY` after both the application release and subsequent docs-only reconciliation
- custom domain: `scopeforge.dev`
- the active production deployment has `scopeforge.dev` as an alias with no alias error
- Cloudflare remains authoritative DNS
- apex application records remain DNS-only and point at Vercel
- Vercel manages TLS and serves HSTS
- `https://scopeforge.dev/` returns 200 with the ScopeForge landing page
- `https://scopeforge.dev/auth/sign-in` returns 200
- `https://scopeforge.dev/auth/sign-up` returns 200
- unauthenticated `/dashboard` resolves to the sign-in surface
- production runtime error inspection reported no runtime errors in the post-deployment verification window
- production Supabase security advisor reported zero security lints

Production browser identity is now explicit and cache-busted:

- `/scopeforge-mark-v2.svg` returns 200 as `image/svg+xml`
- `/manifest.webmanifest` returns 200 and references the same ScopeForge mark for `any` and `maskable` purposes
- page metadata includes `shortcut icon`, `icon`, and `apple-touch-icon` references to `/scopeforge-mark-v2.svg`
- the obsolete special `/icon.svg` route now returns 404, preventing it from competing with the current browser identity

Production environment rules remain:

- `NEXT_PUBLIC_SITE_URL` is `https://scopeforge.dev`.
- public Supabase URL/publishable key may be exposed to the client as designed.
- `SUPABASE_SECRET_KEY` is server-only and must never be placed in a `NEXT_PUBLIC_*` variable or committed.
- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED = false`.
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED = false`.
- R2 remains unnecessary while both hosted repository runtime capabilities are false.
- Turnstile is not wired into active application behavior and must not be described as active.

Preview deployments created during isolated acceptance were not deleted because the currently available Vercel connector exposes no deployment-delete action. The merged production deployment is not affected by those previews. The merged feature branch also remains because the available GitHub connector exposes no safe branch-delete action. Neither limitation changes production state.

A temporary Floot production-operations endpoint remains pending cleanup because the Floot project reached its daily build-action cap during final operations. Stored credentials must be retained. The helper should be deleted after the Floot quota resets; it is not part of the ScopeForge production Vercel application.

## Repository branch cleanup

The pre-deployment cleanup applied the generic ancestry rule to every non-main branch after rechecking open PRs.

- branches before cleanup: 48
- open PRs before cleanup: 0
- branches deleted: 14
- branches remaining immediately after cleanup: 34
- tags deleted: 0

The 14 deleted refs were all proven fully contained in `main` with `ahead_by = 0`:

- `docs/phase-5b-completion-handoff`
- `docs/phase-5b-post-merge-handoff`
- `docs/phase-5b-production-reconciled`
- `docs/phase-6a-worker-foundation-design`
- `docs/phase-6b-repository-acquisition-design`
- `docs/phase-6c-closeout`
- `docs/phase-6c-deployment-readiness`
- `feat/phase-5b-remediation-retest-security-story`
- `feat/phase-5c-hosted-phase3-import`
- `feat/phase-6b-repository-acquisition`
- `feat/phase-6c-zero-egress-scanning`
- `fix/phase-6b-snapshot-runtime-gate-main`
- `phase-1-foundation`
- `phase-2-asset-control`

All 33 other non-main branches were preserved because comparison showed `ahead_by > 0`; `main` was also preserved. No branch with unknown comparison state, divergent/unmerged work, or an open PR was deleted.

## Current boundary

Production control-plane deployment, `scopeforge.dev`, the Living Attack Surface WebGL dashboard, and the browser identity refresh are complete with both repository worker capability gates still false.

The next implementation architecture boundary is **Phase 6D dedicated network-enabled worker execution**. It remains design-gated. Existing passive runtime and bounded active CORS validation may move behind dedicated closed worker classes only after a separate threat model and approved design preserve the current authorization snapshot, immediate pre-network reauthorization, DNS/IP policy, request shapes, owner/admin active consent, fixed budgets, cancellation, deterministic persistence, privacy, quotas/backpressure, and fleet controls.

Phase 6B GitHub networking is not generic egress authority. A generic URL/network worker executor is prohibited.

## GitHub Actions constraint

GitHub Actions monthly allowance remains exhausted and must not be used, triggered, rerun, or relied on as verification evidence.

Continue using `[skip ci]` on repository commits while this constraint remains active. Verification must be executed independently and tied to the exact candidate SHA before merge or completion claims.
