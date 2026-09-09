# ScopeForge Incident Response Runbook

This runbook covers security incidents affecting ScopeForge production, trusted worker infrastructure, private artifact handling, Supabase, Vercel, and related provider integrations. It is operational guidance, not permission to expand ScopeForge runtime authority.

## Severity model

| Severity | Definition | Examples | Initial handling |
| --- | --- | --- | --- |
| SEV-1 Critical | Active or credibly imminent compromise with production-level confidentiality, integrity, or execution impact. | Cross-workspace data exposure, stolen production-control credentials, unauthorized privileged hosted worker execution, materially exploitable control-plane compromise. | Immediate containment, continuous ownership until stable, preserve high-value evidence, rotate affected high-authority credentials after containment. |
| SEV-2 High | Confirmed security defect with substantial impact but no evidence of broad active compromise. | Authorization bypass with constrained prerequisites, significant private artifact exposure, trusted worker authentication defect without confirmed widespread abuse. | Contain the affected path promptly, establish impact scope, prepare remediation and rollback. |
| SEV-3 Medium | Contained weakness with limited impact, defense-in-depth failure, or abuse path requiring meaningful preconditions. | Security-control misconfiguration, bounded metadata leak, rate-limit gap on a non-privileged path. | Assign owner, preserve evidence, remediate on a prioritized schedule, verify no escalation indicators. |
| SEV-4 Low | Low-impact hardening defect, operational/documentation drift, or non-exploitable security regression. | Stale runbook wording, missing security header documentation, non-sensitive diagnostic drift. | Track and correct without emergency production changes. |

Escalate severity whenever evidence shows broader authority, greater data impact, active exploitation, or uncertain blast radius. Downgrade only after evidence supports the narrower classification.

## 1. Detection and incident declaration

Record a bounded incident header before changing production state:

- incident identifier
- declaration time in UTC
- current production Git SHA
- current Vercel deployment identifier
- affected route, worker class, database surface, or provider boundary
- current severity and owner
- the initial observable signal or audit/log reference

Do not copy secrets, request bodies, repository source, or complete environment data into the incident record.

## 2. Immediate containment

Contain the smallest verified affected authority first.

Recommended order:

1. Stop or restrict the affected externally reachable path using a verified provider or application control that already exists.
2. Check all four hosted capability flags and set the affected capability to false or remove the variable where relevant.
3. Preserve bounded audit-event IDs, route identities, timestamps, Vercel Runtime Log references, deployment identities, and database record IDs needed for reconstruction.
4. Prevent further credential use before rotating credentials.
5. Avoid unrelated production changes until the incident boundary is understood.

Hosted capability flags:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

Never turn on a hosted capability during incident response merely to validate recovery. Recovery validation uses the safe disabled state unless that capability has separate operational acceptance and the incident owner has explicitly cleared it.

## 3. Credential and key rotation order

Rotate credentials only after immediate containment prevents continued misuse. Rotate from highest blast radius to narrower authority:

1. credentials that can alter production control-plane configuration or deployment state
2. Supabase server/service credentials and other database-administration secrets
3. private artifact-storage credentials
4. trusted worker credentials and lease/authentication material
5. third-party provider secrets
6. user-facing application credentials only where evidence shows they are affected

Record only the secret category/name, rotation time, operator, and validation result. Never place secret values in the incident record, Git history, screenshots, logs, tickets, or chat transcripts.

After each rotation, verify that the old credential no longer succeeds where the provider offers a safe validation path.

## 4. Supabase containment and recovery

For incidents involving Supabase, authentication, database authority, or RLS:

1. Confirm the exact ScopeForge Supabase project before taking action.
2. Identify whether the issue concerns Auth, public schema access, private worker tables, privileged RPCs, migrations, or server credentials.
3. If a server/service credential may be exposed, contain dependent application paths, rotate the credential through the supported provider surface, and update only the intended production environment reference.
4. Review active sessions or authentication state only as needed for the incident. Revoke or invalidate sessions when provider controls and impact evidence justify it.
5. Verify migration history has no unexpected entries.
6. Re-run the Phase 9C privilege/RLS regression checks relevant to the affected area.
7. Confirm private worker tables remain closed to ordinary browser roles and privileged worker/control RPCs remain unavailable to `anon` and ordinary `authenticated` users.
8. Run Supabase Security Advisor and record exact findings.
9. Recheck application authentication and intended workspace access after recovery.

Do not weaken RLS, broaden grants, expose the private schema, or edit already-deployed migrations as an emergency shortcut.

## 5. Vercel containment, rollback, and traffic control

For incidents involving the web control plane, deployment, environment configuration, browser behavior, or runtime logs:

1. Record the current production deployment ID and Git SHA.
2. Identify a known-good deployment by exact Git SHA before rollback.
3. Roll back or promote only a deployment whose source identity is understood and whose security boundary is acceptable.
4. Inspect Vercel Runtime Logs for bounded security telemetry introduced by Phase 9D.
5. Apply only traffic-control or WAF behavior that is directly available and understood in the current project. Do not invent or assume custom WAF state.
6. Review environment-variable names and affected configuration without copying secret values into evidence.
7. After rollback or containment, verify `https://scopeforge.dev` resolves to the intended production deployment and returns the expected application.
8. Confirm the accepted Command Center UI V5 remains present if the incident is unrelated to UI rollback.

If an edge control cannot be directly inspected, record it as `NOT VERIFIED` instead of relying on it for containment claims.

## 6. Data-impact assessment

Determine the narrowest evidence-supported answer for:

- which workspaces or users could have been affected
- which data classes were reachable
- whether data was only readable, mutable, deletable, or executable
- whether private repository artifacts or source may have been exposed
- whether privileged worker/runtime authority was reachable
- earliest and latest credible exposure time
- whether evidence shows successful exploitation or only vulnerability presence

Do not inflate uncertain impact into a confirmed breach, but do not treat missing telemetry as proof that no impact occurred.

## 7. Evidence preservation rules

Preserve only what is needed to reconstruct and remediate the incident.

Do not collect or store in the incident evidence bundle:

- passwords
- Supabase access tokens
- Supabase refresh tokens
- service-role or server keys
- worker credentials
- lease tokens
- private keys
- complete authorization headers or cookies
- raw repository source
- raw executor stdout/stderr
- complete environment dumps
- unrelated personal data

Prefer:

- exact timestamps
- route and worker-class identities
- bounded `scopeforge.security.v1` metadata
- relevant `audit_events` identifiers
- Git commit and tree SHAs
- Vercel deployment IDs and Git SHAs
- Supabase migration identifiers and advisor findings
- status codes and bounded provider log references
- hashes or record identifiers instead of raw sensitive content

## 8. Recovery validation

Before declaring containment successful or service recovery complete:

1. Verify `https://scopeforge.dev` returns HTTP 200 from the intended production deployment.
2. Verify the production Vercel Git SHA is the intended release or rollback SHA.
3. Confirm accepted V5 desktop/mobile markers and poster assets remain present unless the incident specifically required UI rollback.
4. Re-run affected authentication and authorization regression checks.
5. Re-run relevant database privilege/RLS checks and Supabase Security Advisor.
6. Recheck all four hosted capability flags. They must remain false or absent unless a separately accepted operational change explicitly authorizes otherwise.
7. Confirm rotated credentials work only in their intended service path and superseded credentials no longer work where safe verification exists.
8. Review security telemetry for renewed incident indicators during the recovery window.
9. Confirm CSP, Turnstile, leaked-password protection, and WAF state truthfully rather than assuming an unrelated control became active.

## 9. Communication and coordinated disclosure

Keep active exploit details private while remediation is in progress. External communications should separate confirmed facts, current risk, containment actions, and remaining uncertainty.

For vulnerability reports received through the public security policy, coordinate disclosure timing with the reporter where practical and avoid publishing details that would materially increase exploitation risk before remediation.

## 10. Post-incident review

After recovery, record:

- root cause and contributing conditions
- exact detection source and gaps
- containment timeline
- credential rotations performed
- affected data/authority conclusion and evidence strength
- remediation commits and deployment identities
- tests or architecture guards added
- provider-control changes, if any
- rollback quality and recovery issues
- follow-up actions with owners

Do not use the post-incident review as a reason to silently widen ScopeForge runtime authority, disable safety controls, or add unreviewed provider integrations.
