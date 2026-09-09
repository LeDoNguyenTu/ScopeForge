# Phase 9E Incident Readiness and Release Engineering Design

## Status

Approved umbrella authority: `docs/superpowers/specs/2026-09-08-phase-9-security-hardening-design.md`, section 9.

This subphase refines that already-approved Phase 9E boundary into repository-native operational artifacts and an exact-release evidence workflow. It does not expand runtime, scanner, database, provider, or UI authority.

## Goal

Make ScopeForge operationally ready to respond to security incidents and to decide whether an exact production release is safe to publish, using evidence that can be independently checked without introducing a new incident-management subsystem.

## Starting point

Phase 9A through Phase 9D are released. The accepted Command Center UI V5 is already on `main` and is authoritative.

The four hosted runtime capabilities remain false or absent unless separately accepted:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

Current provider claims remain conservative:

- CSP is not enforced.
- Production Turnstile enforcement is not claimed until directly verified.
- Supabase leaked-password protection is not claimed enabled until directly verified.
- Vercel project-specific custom WAF rule state is not claimed until directly inspected.
- Supabase native Auth rate limiting remains the authentication-endpoint limiter.

Phase 9E must not silently change any of these provider states.

## Architecture choice

Use repository-native documentation plus a deterministic release-evidence record.

Phase 9E consists of four deliberately small units:

1. a public-facing security disclosure policy in `SECURITY.md`
2. an internal incident response runbook under `docs/security/`
3. a release-security checklist under `docs/security/`
4. a Phase 9E release-state record under `docs/development/` that captures exact Git, CI, Vercel, Supabase, provider, runtime-flag, and UI-preservation evidence

No new runtime service, queue, database table, alert platform, dependency, or browser feature is introduced.

## 1. Security disclosure policy

Expand the current minimal `SECURITY.md` into an operational policy that is safe to publish.

It must include:

- use of GitHub private vulnerability reporting as the preferred private reporting route when available
- an explicit fallback to another private repository-owner channel only if GitHub private reporting is unavailable, without publishing private credentials or sensitive contact data
- acknowledgement target of 3 business days
- initial severity/triage target of 5 business days when sufficient reproduction information is available
- coordinated disclosure expectation while a fix is being prepared
- a clear prohibition on public release of active exploit details before remediation or an agreed disclosure date
- ScopeForge authorization boundaries: only systems the tester owns or is explicitly authorized to assess
- report contents that help triage without requesting secrets, passwords, tokens, private keys, raw production data, or unnecessary personal data
- a statement that timing targets are operational goals rather than a paid security SLA

The public policy must not expose service-role keys, deployment credentials, private email addresses, phone numbers, worker credentials, or internal provider identifiers that are not already intentionally public.

## 2. Incident severity and response model

Create `docs/security/INCIDENT_RESPONSE.md`.

Severity levels are closed and operational:

- SEV-1 Critical: active compromise, credential theft with production authority, cross-workspace data exposure, unauthorized privileged worker/runtime execution, or materially exploitable production control-plane compromise
- SEV-2 High: confirmed security defect with substantial confidentiality/integrity impact but no evidence of active broad compromise
- SEV-3 Medium: contained security weakness with limited impact, meaningful defense-in-depth failure, or abuse path requiring constrained preconditions
- SEV-4 Low: low-impact hardening defect, documentation/control drift, or non-exploitable security regression

The runbook must define:

1. detection and incident declaration
2. severity assignment and escalation
3. immediate containment
4. hosted runtime disablement where relevant
5. credential/key rotation order
6. Supabase containment and recovery
7. Vercel rollback and traffic-control actions
8. data-impact assessment
9. evidence preservation
10. recovery validation
11. post-incident review

### Runtime containment

The safest first action for suspected hosted execution abuse is to verify all four capability flags and set the affected capability to false or remove it before broader recovery work. The runbook must preserve the distinction between each capability instead of treating hosted execution as one generic switch.

The runbook must never instruct an operator to enable a capability during incident response merely to test recovery.

### Credential rotation order

Rotate from highest blast-radius credentials toward narrower credentials after containment is in place. The documented order is:

1. credentials that can alter production control-plane configuration or deployment state
2. Supabase server/service credentials and other database-administration secrets
3. private artifact-storage credentials
4. trusted worker credentials and lease/authentication material
5. third-party provider secrets
6. user-facing application credentials only where evidence shows they are affected

The runbook stores only secret names/categories and rotation checkpoints, never secret values.

### Evidence rules

Preserve bounded metadata required to reconstruct what happened while avoiding collection of:

- passwords
- Supabase access or refresh tokens
- service-role/server keys
- worker credentials or lease tokens
- private keys
- complete authorization headers or cookies
- raw repository source
- raw executor stdout/stderr
- complete environment dumps
- unrelated personal data

Prefer exact timestamps, request/route identities, Git/deployment identifiers, bounded security-event metadata, relevant audit-event IDs, and provider log references.

## 3. Release-security checklist

Create `docs/security/RELEASE_SECURITY_CHECKLIST.md`.

The checklist is evidence-driven. A release claim is either:

- PASS with exact evidence
- NOT APPLICABLE with a reason
- NOT VERIFIED
- BLOCKED

There is no implied PASS.

The exact release candidate must record:

### Repository and CI

- exact candidate commit SHA and Git tree
- exact base `main` SHA
- changed-file review
- no unresolved review threads or requested changes
- focused tests where applicable
- full `npm test`
- `npm run typecheck`
- `npm run build:cli`
- CLI `version` execution
- `npm run benchmark:scanner`
- `npm run benchmark:matrix`
- production `npm run build`
- `npm audit --audit-level=info`

### Database and Supabase

- Supabase project identity is the ScopeForge project, not any unrelated project
- Security Advisor result
- Phase 9C privilege/RLS regression evidence remains valid
- no unexpected migration drift
- leaked-password-protection state recorded as verified enabled, verified unavailable, or NOT VERIFIED

### Vercel and edge

- exact candidate Preview is READY before merge when a preview is produced
- post-merge production deployment is READY
- production deployment Git SHA equals merged `main`
- `scopeforge.dev` returns HTTP 200 after release
- V5 markers/assets remain present
- edge/WAF controls are recorded only from directly inspected evidence
- rollback target and rollback procedure are known before release

### Auth and abuse controls

- Turnstile provider enforcement is recorded only if directly verified
- Supabase Auth rate limiting remains in force
- no release claim assumes custom WAF/rate-limit rules that were not inspected

### Runtime authority

All four hosted runtime flags must be directly checked. Any unexpected true value is a release blocker unless a separate accepted runtime-enablement change explicitly authorizes it.

### Browser hardening

- current security-header baseline remains present
- CSP state is recorded truthfully
- Phase 9E does not enforce CSP

## 4. Release-state record

Create `docs/development/PHASE_9E_RELEASE_STATE.md` after the candidate is frozen.

This is the authoritative handoff for the subphase and must include:

- exact branch/base/head/tree identities
- PR identity
- candidate CI evidence
- merge identity
- post-merge `main` CI evidence
- exact Vercel deployment identity and Git SHA
- fresh production HTTP verification
- Supabase/security-advisor truth
- auth/Turnstile truth
- WAF truth
- CSP truth
- four runtime-flag states
- V5 preservation evidence
- unresolved blockers, if any
- whether Phase 9 can be called complete
- strict CSP as the separate next compatibility gate if Phase 9 otherwise closes

## 5. Testing strategy

Phase 9E is predominantly operational documentation, but its permanent invariants should be regression-tested where repository-native tests already exist.

Add an architecture/documentation test that verifies:

- `SECURITY.md` names private reporting and coordinated disclosure
- the incident runbook contains all four hosted runtime flags
- the incident runbook contains explicit evidence-exclusion language
- the release checklist contains the required exact-SHA validation commands
- the release checklist treats unknown provider state as non-passing
- Phase 9E documentation does not claim CSP enforcement

The test must read repository files as data only. It introduces no network, process, browser, database, or provider authority.

## 6. Production/provider verification

Provider inspection is evidence collection, not permission to mutate provider state.

During Phase 9E:

- read current Supabase project/security-advisor state
- read current Vercel project/deployment state
- verify the exact release deployment and production domain
- inspect available edge/WAF state only through supported read surfaces
- record Turnstile/leaked-password state conservatively

Do not:

- upgrade billing
- enable leaked-password protection without a separately supported and reviewed mutation path
- enable Turnstile provider enforcement unless all protected flows and rollback are directly verified
- add custom WAF rules merely to make the checklist green
- enable any hosted runtime capability

A provider control that cannot be directly inspected is recorded as NOT VERIFIED, not inferred.

## 7. Branch, UI, and scope isolation

Implementation branch: `feat/phase-9e-incident-release-engineering-v1`.

Start from exact current `main`.

Do not use historical `preview/*`, `diag/*`, V4, or stale Phase 9 branches as an implementation base.

Do not change:

- Command Center V5 presentation files
- Supabase migrations or RLS policies
- runtime worker implementations
- hosted capability defaults
- scanner families or security-pack behavior
- package dependencies
- CSP enforcement

Any unexpected need to touch those surfaces is a scope expansion and must stop Phase 9E rather than being folded in silently.

## 8. Branch cleanup policy

Old diagnostic, preview, reconciled, and completed feature branches may be removed only after their useful commits are confirmed merged or intentionally superseded and no open PR depends on them.

Deletion must use a genuine branch/ref deletion operation. Moving stale refs to `main` is not branch deletion and must not be used as a substitute.

`main` and the active Phase 9E branch are always preserved.

## Completion criteria

Phase 9E is complete when:

- public `SECURITY.md` is operational and private-reporting oriented
- incident runbook covers severity, containment, rotation, Supabase, Vercel, evidence, recovery, and post-incident review
- exact release-security checklist is complete and regression-tested
- exact candidate passes the repository validation gate
- exact production release is verified after merge
- Supabase and provider truth are recorded without overclaiming
- all four hosted runtime capabilities remain false or absent unless separately authorized
- accepted V5 UI is preserved
- release-state documentation is committed
- no unresolved Phase 9E release blocker remains

Strict CSP enforcement remains a separate compatibility gate after Phase 9E.