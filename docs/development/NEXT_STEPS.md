# ScopeForge Next Steps

> **2026-09-01 resume override:** Do not begin Phase 6D design or implementation
> from the older sequence below. PR #51 is merged and PR #52 contains the
> implementation at `bd558fdf0830bfdb95027374e168835a8a48f43d`. Resume only
> the fresh read-only Supabase reconciliation in `PHASE_6D_TASK16_REVIEW.md`,
> keep all four hosted worker flags false/absent, and leave dashboard UI work
> untouched until its owner explicitly releases that scope.

## Current boundary

Phase 6C isolated zero-egress Phase 3 scanning is complete and merged through PR #39.

- exact verified Phase 6C head: `d0b7c7a3a1de9d626478cf75cad5ee809f52dc3b`
- Phase 6C merge commit: `7a329dc2796a142102af2392ee461f205daa1b78`
- deployment-readiness docs merge: PR #40, merge commit `415428ebc510a7a8e890d3a03ebc4ffb8194252a`
- repository acquisition public runtime gate: PR #41, merge commit `07c6bc8580314b73c633a7b704e5f7557ceccb4d`
- ScopeForge Supabase project: `tdgpibrepzcvdivztkta`

Phase 6B repository acquisition and Phase 6C hosted repository scanning are both implemented as closed worker boundaries, but neither worker-backed operation is enabled in the public control plane until its production runtime acceptance gate is proven.

## Phase 6C verification evidence

The exact Phase 6C head was verified outside GitHub Actions with the deterministic dependency lock:

- lock SHA-256: `3bbc74fa07cf06b379058c741423974f30b46f5c4469694750e1b973fbccda7d`
- lock Git blob: `881bbdeedb0ee7a7cb8c171ca93b14f6e528d33d`
- `npm ci` passed
- `npm run typecheck` passed
- 227 test files and 952 tests passed
- `npm run build:cli` passed
- CLI version check returned `ScopeForge 0.1.0`
- scanner benchmark passed with 700 files and zero errors
- production Next.js build passed with the ScopeForge public production configuration
- `npm audit` reported zero vulnerabilities at every severity

The subsequent Phase 6B acquisition runtime gate was independently verified on exact head `f1e67a07250f194f315d5be1081b780f62da4f26` with 227 test files and 955 tests, production build success, and zero audit vulnerabilities before PR #41 merged.

## Runtime gates that must remain closed

### Repository acquisition

`HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED` remains `false`.

Do not enable hosted repository acquisition until the separate acquisition worker and private artifact store are deployed and acceptance-tested. Existing immutable snapshot history may remain readable while acquisition is unavailable.

### Hosted repository scanning

`HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED` remains `false`.

Do not enable hosted repository scanning until a real Linux rootless-Podman/cgroup-v2 acceptance environment demonstrates all of the following:

- zero network access from the scanner container
- read-only scanner input and root filesystem boundaries
- enforceable CPU, memory, process, scratch, input, output, and wall-time limits
- cancellation and hard deadlines terminate the underlying container
- fixed reviewed image and command, with no caller-controlled image, command, environment, scanner selection, or network policy
- immutable snapshot size/content/artifact digest verification before scanner use

Repository code remains data only. Package lifecycle scripts, project commands, hooks, build systems, nested container definitions, arbitrary dynamic imports, and target-provided execution are not scanner authority.

## Production deployment

The next operational priority is the ScopeForge web control-plane deployment to Vercel and `scopeforge.dev` while both worker-backed repository features remain gated off.

Production deployment requirements:

- deploy the exact reviewed `main` tree
- keep Cloudflare authoritative for DNS
- keep Vercel application A/CNAME records DNS-only in Cloudflare
- let Vercel manage application TLS
- set `NEXT_PUBLIC_SUPABASE_URL` to the ScopeForge Supabase project
- set the active ScopeForge `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- set `NEXT_PUBLIC_SITE_URL=https://scopeforge.dev`
- set the ScopeForge server-only `SUPABASE_SECRET_KEY`
- do not place Supabase secret/service credentials in browser-visible variables
- R2 credentials are not required to enable the public web control plane while acquisition/scanning remain disabled
- verify HTTPS, auth routes, dashboard behavior, runtime errors, and production logs before describing the launch as healthy

Turnstile remains a separate production-hardening item until it is actually wired into the authentication implementation. Do not document a configured captcha as active merely because environment names exist in deployment guidance.

## Phase 6D boundary

Phase 6D dedicated network-enabled worker execution remains a separately reviewed architecture boundary. Do not treat Phase 6B GitHub networking as generic egress authority.

Before implementation, Phase 6D requires its own threat model and approved design covering at minimum:

- separate closed worker classes for passive runtime observation and bounded active CORS validation
- preservation of the existing authorization snapshot plus immediate pre-network reauthorization model
- verified target, DNS/IP, redirect, TLS, and request-shape policy
- owner/admin consent for active validation
- fixed profiles and budgets
- queue quotas and backpressure
- cancellation and hard-deadline termination
- artifact/privacy boundaries
- fleet operational controls
- deterministic trusted persistence semantics

No generic URL executor or caller-configurable networking primitive may be introduced.

## GitHub Actions constraint

Do not use, trigger, rerun, or depend on GitHub Actions while the user's monthly allowance remains exhausted.

Continue using `[skip ci]` on implementation, test, migration, dependency, and documentation commits. Verification must be performed in an independent runnable environment and tied to the exact SHA being reviewed or merged.

## Resume protocol

1. Re-check exact `main` and any active branch before mutation.
2. Read `CURRENT_STATE.md`, `TEST_STATUS.md`, this file, `docs/ARCHITECTURE.md`, and `docs/PHASES.md`.
3. Keep the ScopeForge Supabase project `tdgpibrepzcvdivztkta` separate from every other project.
4. Never rewrite deployed migrations. Use forward migrations only.
5. Keep worker credentials, private R2 object keys, Supabase secret credentials, and lease credentials outside browser code.
6. Preserve cancellation-first publication, exact lease binding, immutable snapshot provenance, artifact digest binding, and worker-class separation.
7. Do not enable either hosted repository worker feature until its stated production acceptance evidence exists.
8. Read `PHASE_6D_RELEASE_STATE.md` and `UNFINISHED_WORK.md`; they supersede the older Phase 6C-to-6D sequencing in this file.
