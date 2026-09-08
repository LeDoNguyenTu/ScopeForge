# ScopeForge Next Steps

Last reconciled: 2026-09-09 (Asia/Singapore)

## Completed boundaries

Do not recreate these released phases:

- Phase 7 Community Security Packs v1
- Phase 8A offline accuracy foundation
- Phase 8B scanner performance matrix
- Phase 8C reproducible technical publication
- Phase 9A authentication-boundary hardening
- Phase 9B Turnstile-capable provider/auth hardening code
- Phase 9C database/RPC defense-in-depth

Current production `main` baseline:

`f203168e6ae25455743849f08511e371d3964153`

Current production tree:

`9980aa5a58014998fd26ae7084bd97c992bc1a82`

This tree includes the current production UI plus released Phase 9A/9B/9C security work. All remaining implementation must start from the actual current `main` rather than any historical security baseline or PR #49.

## Immediate priority - Phase 9D security telemetry and browser hardening

Phase 9D is the next implementation boundary.

Approved direction:

- reuse `audit_events` and `lib/audit/write-audit-event.ts` for durable workspace security-significant events
- use structured privacy-reduced server logs for high-frequency operational security signals
- never log passwords, tokens, API keys, credentials, cookies, authorization headers, worker lease tokens, source content, or raw executor output
- preserve the current security-header baseline
- stage CSP carefully and require compatibility proof with the actual production Next.js/WebGL UI before enforcement
- do not ship a broad `unsafe-inline` CSP merely to claim CSP coverage
- do not couple security telemetry to visual components

Required Phase 9D sequence:

1. Re-read the current production audit writer, audit-event schema, security-relevant routes/RPC boundaries, middleware, `next.config.ts`, and current logging patterns.
2. Define a narrow security-event taxonomy and decide which events are durable audit events versus high-frequency operational logs.
3. Define privacy-reduced log/event fields, explicit secret-key deny rules, size bounds, and failure behavior.
4. Add failing tests for metadata safety, event-shape allowlists, and any new security-significant audit coverage before implementation.
5. Add structured operational logging only where it improves detection/rollback without flooding durable audit storage.
6. Define observable alert/rollback signals using available Vercel runtime evidence rather than inventing an unverified external alerting system.
7. Preserve current browser headers unless a concrete weakness is being corrected.
8. Treat CSP as a separate compatibility gate: first produce and test a candidate policy against the exact current production UI/WebGL behavior, then enforce only if the compatibility evidence is clean.
9. Do not edit or resurrect PR #49.
10. Freeze an exact candidate only after current `main` drift is reconciled and the production UI is preserved.
11. Require exact-head preview, one substantive candidate CI, post-merge main CI, exact production deployment verification, and a docs-only release checkpoint.

Before Phase 9D implementation, follow the repository design/plan workflow and keep the approved Phase 9 architecture boundaries explicit.

## Phase 9B operational provider follow-up

Phase 9B code is released, but provider enforcement remains a separate launch prerequisite.

Current truth:

- leaked-password protection remains disabled according to Supabase Security Advisor
- production Turnstile enforcement is not claimed until external provider configuration is directly verified
- Vercel project-specific WAF custom-rule state is not claimed without direct inspected evidence
- Supabase native Auth rate limiting remains the auth-endpoint limiter

Do not silently add billing, provider secrets, or external firewall rules. Any provider activation must use a supported inspected surface, record rollback, and be verified after change.

## Phase 9E after Phase 9D

Complete incident and release readiness:

- private vulnerability disclosure workflow
- severity/triage procedure
- containment and worker-disable procedure
- credential rotation runbook
- Supabase/Vercel rollback procedures
- impact assessment and recovery checks
- post-incident validation
- final security release checklist and exact deployment evidence

## Outstanding database review item

Legacy broad SQL grants on `profiles`, `workspaces`, and `workspace_members` remain a separate review point. RLS is enabled and Phase 9C did not change these grants. Do not silently mix cleanup into Phase 9D unless the reviewed design explicitly expands scope.

## Runtime authority

Keep false/absent until their own operational acceptance:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

## UI baseline rule

The production `main` tree is authoritative. Before freezing or merging remaining security work, re-read `main` and resolve any concurrent UI drift first. Preserve the newest production UI and reapply only the reviewed security delta when overlaps occur.

PR #49 remains an open draft legacy UI branch and must remain untouched unless separately requested.
