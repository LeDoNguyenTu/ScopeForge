# Codex Priority 0 — Phase 10A2 Worker/Private-Repository Acceptance

Last refreshed: 2026-09-16, Asia/Singapore

This is the first task Codex must attempt when it next has an authorized terminal/OCI session. Do not spend the session redoing already-complete provider, schema, or application work before checking this gate.

## Why this is Priority 0

Phase 10A2 application implementation is already on PR #76. Issue #79 is closed. Both Phase 10A2 production migrations are already applied and the production ACL/schema posture has been inspected. The private canary repository and deterministic scanner fixture already exist.

The only identified release-blocking work is real Linux worker/runtime/private-repository acceptance.

## Required live starting checks

1. Fetch live `origin/main`, PR #76 and PR #77. Never trust an embedded SHA as the current tip.
2. Confirm PR #76 is still draft and determine its exact current head and latest executable parent.
3. Confirm no newer executable change invalidated the last tested executable candidate `4ef285473402336b4488af4e1c2b4b1ea28d5eb7`.
4. Read `docs/development/PHASE_10A2_WORKER_OPERATIONS.md`, `CODEX_HANDOFF.md`, `CURRENT_STATE.md`, `NEXT_STEPS.md`, and `PHASE_10A2_WORKING_STATE.md`.
5. Verify ScopeForge Supabase is `tdgpibrepzcvdivztkta`. Never use the Job Command Center project.
6. Verify repository runtime gates are still false/absent before starting workers.

## Host task

Historical accepted host:

- Oracle VM public IP: `168.107.81.228`
- SSH user: `ubuntu`
- historical access: OCI Cloud Shell with the owner's SSH key
- historical platform: Ubuntu 24.04, rootless Podman, cgroup v2

The last ChatGPT-side connection attempt found public TCP/22 refusing connections. Codex should first resolve legitimate host access through OCI/authorized SSH; it must not copy a private key into the repo, chat, PR comments, Vercel, or Supabase.

Once connected:

1. verify Node 24, rootless Podman, cgroup v2 controllers, systemd delegation, disk/memory/PID prerequisites, and the dedicated `scopeforge-worker` account
2. build the exact candidate with `npm ci` and `npm run build:workers`
3. deploy `scopeforge-worker.cjs` and `hosted-scanner-entry.js` under `/opt/scopeforge/current`
4. build the pinned scanner image locally and record the immutable image digest
5. generate two worker secrets only on the host; store them only in root-owned mode-0600 environment files
6. register only credential hashes through the intended production service-role RPCs
7. start the private snapshot and zero-egress repository-scan workers while all repository runtime gates are still disabled
8. prove authenticated idle claim/heartbeat behavior before enabling any runtime gate

## Provider/canary task

Dedicated private canary only:

- repository: `LeDoNguyenTu/scopeforge-private-canary`
- fixture commit: `d95ca07123e28ee64de799e87651c2a3b6edb5cf`
- expected finding: high-confidence `jsts/command-injection`, CWE-78

The ScopeForge GitHub App uses selected-repository access. There is not yet verified evidence that `scopeforge-private-canary` is in that selected set. Add/verify it through the legitimate GitHub owner/admin installation settings flow; never fabricate provider authority or insert a repository-link row manually.

Then enable only the Phase 10A2 repository gates for a bounded acceptance window and prove the full path:

`private GitHub repository -> exact private archive lease -> immutable source snapshot -> zero-egress repository scan -> expected CWE-78 finding`

Also verify cancellation, lease recovery, process/container cleanup, scratch/output/resource ceilings, provenance, privacy-reduced logs, credential isolation, and rollback.

## Release decision

If any authorization, containment, privacy, cleanup, provenance, or rollback check fails:

- disable repository runtime gates
- stop affected workers if required
- preserve evidence
- fix through TDD
- rerun exact-candidate acceptance
- keep PR #76 draft

Only after every Phase 10A2 operational check passes:

1. refresh persistent evidence with exact SHAs, worker/image identities, non-secret run IDs and verdicts
2. mark PR #76 ready
3. merge using the expected live head
4. verify post-merge `main` CI and exact production deployment
5. only then reconcile/fresh-validate PR #77 and begin Phase 10A3 release acceptance

## Do not redo before Priority 0

Unless new evidence proves regression, do not spend the next host-capable session redoing:

- issue #79 authorization canaries
- PRs #113, #114, #115, #119, #120, #121
- Phase 10A2 production migrations
- Phase 10A2 database ACL/schema inspection
- creation of the private canary fixture

## No-fabrication rule

Historical Phase 6D containment, green CI, Vercel previews, or schema presence are not substitutes for the exact Phase 10A2 production worker/private-repository canary. Do not fabricate workers, repository links, memberships, findings, or host evidence to clear this gate.
