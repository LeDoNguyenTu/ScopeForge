# ScopeForge Session Handoff

Last refreshed: 2026-09-16, Asia/Singapore

Use with `CODEX_HANDOFF.md`, `CURRENT_STATE.md`, `NEXT_STEPS.md`, `UNFINISHED_WORK.md`, and `PHASE_10A2_WORKING_STATE.md`. Inspect live GitHub/Supabase/Vercel before acting.

## Exact handoff

Phase 10A2 application implementation, provider authorization, schema deployment, and database ACL validation have advanced. The remaining release gate is dedicated Linux worker/private-repository operational acceptance.

Pre-doc executable candidate:

`4ef285473402336b4488af4e1c2b4b1ea28d5eb7`

Verification:

- CI `35102938452`: success
- Vercel `dpl_Cgt5cBd5guXKvVEfRDJS8fEXKENE`: READY
- PR #76 returned to DRAFT until operational acceptance passes
- issue #79 CLOSED
- production Phase 10A2 migrations APPLIED
- Phase 10A2 worker identities: 0
- Phase 10A2 queued tasks: 0

Private canary:

- repo: `LeDoNguyenTu/scopeforge-private-canary`
- fixture commit: `d95ca07123e28ee64de799e87651c2a3b6edb5cf`
- expected scan signal: `jsts/command-injection`, high confidence, CWE-78

Host:

- Oracle public IP: `168.107.81.228`
- SSH user: `ubuntu`
- historical access via OCI Cloud Shell + owner-held private key
- current public TCP/22: connection refused from this session
- no private key or OCI host-control surface available in this chat

Do not bypass the missing host session by registering unusable worker credentials, inserting a private repository link manually, or claiming historical acceptance.

## Resume exactly here

Once an authorized terminal reaches the host, follow `PHASE_10A2_WORKER_OPERATIONS.md` against the exact live #76 candidate, generate credentials on-host, register hashes only, verify idle workers with gates disabled, legitimately add/import the private canary through the ScopeForge GitHub App, run the bounded end-to-end canary, verify cleanup/privacy/rollback, then release #76 if and only if all evidence passes.

PR #77 remains untouched until #76 is released and production-verified.
