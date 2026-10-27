# ScopeForge phone continuation checkpoint

Updated 2026-10-28, Asia/Bangkok. Live GitHub/provider state wins.

## Released

- PR #216: merged as `2a7eba25dcd6060dbfd1ad9e048f4ea4deb0d564` after owner authorization for the administrative merge required by branch policy.
- Candidate CI `40548572541` and main CI `40551443353`: success.
- Vercel `dpl_55gguyeyJShZDVQhvb7ToBYRDQ4F`: READY on `scopeforge.dev` for that merge.
- Five production admin routes redirect 307 with nonce CSP; no new admin runtime errors in the observed verification window beginning `2026-10-27T17:34:17Z`.
- Issues #212 and #215: closed. Dependency audit: zero findings after patch-level updates.

## Open releases

- PR #217: `fix/workspace-navigation-scroll-owner-20261028`, head `a966e6cb4d32207777c2fc80720759f1f99142cc`, base `main`. CI `40550299116` passed; mobile/tablet/desktop screenshots inspected. One workspace scroll owner plus conditional edge fade. Owner administrative merge approval is pending. Issue #213 remains open until release verification.
- PR #218: `fix/phase12-host-script-permissions-20261028`, stacked on #217. Runtime source `8472f33c9c2ad04b29e436b07b551ac8ed062ae2`; final CI and administrative merge approval remain required. Documentation-only continuation commits may advance the branch; verify the live head and checks before merging.

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

Before continuing, fetch/prune, inspect all open PRs/issues and current CI, inspect the worktree, and read the canonical handoffs. Normal GitHub merge is blocked by branch policy and auto-merge is disabled; administrative merge authorization granted for #216 must not be silently expanded to other PRs.
