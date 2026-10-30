# ScopeForge phone continuation checkpoint

## Current: 2026-10-30

- Released main `7e62d103` (PR #220), candidate CI `41033282669` passed;
  main CI `41038513290` passed. Deployment `dpl_F8BZ15BQbDLcnmYZWB7qGLgsk3TF`
  is READY on `scopeforge.dev`; root/admin redirect checks passed.
- PR #220 merged with explicit owner administrative authorization; #214 closed.
  Exact executable source `fad38148` passed real Oracle
  external HTTPS fixture acceptance and 44 focused Linux tests, including actual
  supervisor SIGTERM cleanup followed by a successful rerun.
- Pinned dialing, hostile requests, connection/byte/deadline budgets,
  real-provider cancellation, kernel ceilings, zero capabilities, scratch
  exhaustion and cleanup passed. Temporary fixture project/deployment deleted.
- Host evidence: `/home/scopeforge-worker/phase12-host-tunnel-20261030/.artifacts/host-tunnel.evidence.json`.
- Owner authorization for #220 was used for that PR only. No merge permission
  is inferred for later PRs.
- After release, review the dedicated Phase 12 worker/control-plane design.
  No database, worker or capability enablement was performed. Providers stay off;
  Phase 11 acceptance remains complete without another canary.

The current checkpoint supersedes older unfinished-harness statements below.

Updated 2026-10-28, Asia/Bangkok. Live GitHub/provider state wins.

## Released

- PR #216: merged as `2a7eba25dcd6060dbfd1ad9e048f4ea4deb0d564` after owner authorization for the administrative merge required by branch policy.
- Candidate CI `40548572541` and main CI `40551443353`: success.
- Vercel `dpl_55gguyeyJShZDVQhvb7ToBYRDQ4F`: READY on `scopeforge.dev` for that merge.
- Five production admin routes redirect 307 with nonce CSP; no new admin runtime errors in the observed verification window beginning `2026-10-27T17:34:17Z`.
- Issues #212 and #215: closed. Dependency audit: zero findings after patch-level updates.

- Final released `main`: `a577739230a2b717caabfc28e8a33cad2a2e0c64` (PR #218), following PR #217 merge `444d7ffcfb59527d7aa141f4570606b6d9093771`.
- Final deployment: `dpl_6eHQiN19RLYsXLFreRYxVFYh9UhR`, READY on `scopeforge.dev`. Main CI `40560380937`: success.
- Authenticated production Chrome verified Security Runs and Workspace navigation, active-link visibility, one scroll owner, no page overflow and keyboard focus visibility. Effective production viewport was 520 CSS pixels; CI screenshots cover 390, 768 and 1440.
- Issue #213 is closed. Fresh read-only database checks reconfirmed the unchanged control-plane boundary.

## Completed releases

- PR #217: candidate `a966e6cb4d32207777c2fc80720759f1f99142cc`, CI `40550299116` passed; mobile/tablet/desktop screenshots inspected. Merged after explicit owner administrative authorization and verified in production.
- PR #218: candidate `a818f2e946bcb2ef7e16ab0fc84cda90f670bcae`, CI `40553671820` passed. Merged after #217 with separate explicit owner administrative authorization. Runtime source `8472f33c9c2ad04b29e436b07b551ac8ed062ae2` retains the real Oracle evidence; comparison confirms the merged runtime files are identical.

## Oracle evidence

Target-free httpx bundle passed at runtime source `8472f33c9c2ad04b29e436b07b551ac8ed062ae2`. The original PID/resource limits were retained. The preflight fixes libuv to one thread, and the trusted sidecar fixes the V8 pool to one thread and uses a fixed low-process readiness check.

- worktree: `/home/scopeforge-worker/phase12-acceptance-20261028`
- evidence: `.artifacts/phase12-provider-acceptance/httpx-linux-amd64-8472f33c9c2a`
- immutable images/hashes: `docs/validation/post-v1/PHASE12_HOST_SCRIPT_PERMISSIONS.md`
- cleanup: zero acceptance containers and egress sockets; all three accepted services active
- prerequisite installed: Ubuntu `unzip=6.0-28ubuntu4.1`; no package upgrades/removals or worker restarts

## Next source/runtime task

Issue #214's real host-tunnel Linux acceptance harness remains unfinished. Compose the existing tunnel and two-container sandbox; require separate reviewed exact-target authorization for successful external contact. Prove pinned-IP dialing, hostile host/port/nonce/frame rejection, byte/connection/deadline budgets, cancellation, real-provider resource ceilings and idempotent cleanup.

httpx and Nuclei remain default-off. No Phase 12 execution class, queue route, migration, production target authority or canary is accepted. Do not rerun the accepted Phase 11 canary.

## Account and safety checkpoint

GitHub owner: `LeDoNguyenTu`. Supabase connection `214nsa` exposes correct project `tdgpibrepzcvdivztkta`; fresh read-only evidence shows no Phase 12 provider worker, zero active Phase 11 HTTP tasks, one unrelated queued public snapshot task and zero direct private-table grants to `anon`/`authenticated`. Leave the queued task untouched.

Before continuing, fetch/prune, inspect all open PRs/issues and current CI, inspect the worktree, and read the canonical handoffs. Normal GitHub merge is blocked by branch policy and auto-merge is disabled. Explicit owner authorizations for #216, #217 and #218 were used for those PRs only; future administrative merges need their own applicable authority.
