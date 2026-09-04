# ScopeForge Unfinished Work Queue

Last reconciled: 2026-09-05 (Asia/Singapore)

This is the persistent non-UI resume queue.

## Global rules

- preflight before CI; do not use Actions as the first debugging loop
- do not claim green gates without exact-SHA evidence
- keep deployed Supabase migrations immutable; corrections are forward-only
- keep all hosted worker/runtime capability flags false/absent until their own production acceptance gates authorize enablement
- Turnstile is not active unless actually wired into application behavior
- do not add generic URL/proxy/browser/arbitrary network authority
- do not modify, merge, replace, retarget, or deploy active dashboard V5/UI work from this stream
- no AI co-author attribution

## 1. Phase 7 - final release gate only

Branch:

`feat/phase-7-community-security-packs-v1`

PR:

`#54 - Phase 7 community security packs implementation`

Base:

`main` at `4ec80199ed922a5d9c92041e5432a8355f4a4277`

Fully tested source candidate:

`e8bef81d36090402cab7af77e549e3ef268c4eef`

Tasks 1-8 are complete. Task 9 preflight/security review is complete except for the final non-root Linux CI confirmation and integration.

Remaining:

1. preflight final documentation-only head
2. confirm no review-thread/Vercel blocker
3. trigger exactly one CI run via draft -> ready on the same SHA
4. require exact-head green CI
5. squash merge with exact-head protection and `[skip ci]` release subject if still mergeable
6. keep all runtime capability flags disabled

Do not recreate Tasks 1-8.

## 2. Phase 8 - broader validation/public methodology

Methodology foundation PR #50 is already merged. Remaining work:

- vulnerable/ground-truth labs
- measurable precision/recall/false-positive tracking where valid
- regression corpora
- scanner benchmark methodology
- limitations documentation
- technical validation reports

## 3. Production worker enablement - separate from code phases

### Phase 6B

Hosted GitHub acquisition remains disabled pending acquisition-worker/private-artifact operational acceptance, monitoring, rollback, and canary evidence.

### Phase 6C

Hosted zero-egress repository scanning remains disabled pending its own real execution-boundary acceptance for zero egress, read-only input/rootfs, resource enforcement, and cancellation/container termination.

### Phase 6D

Passive and active runtime worker enablement remain separate post-merge gates. Each requires source/image identity, monitoring/rollback, staged canary evidence, and the existing authorization/network-safety controls.

Do not use Phase 6D containment evidence as automatic authorization for 6B or 6C.

## 4. Phase 9 hardening/public release

Remaining non-UI items include:

- Supabase leaked-password protection warning
- threat review and abuse prevention
- Turnstile/equivalent integration if still desired
- observability and alerting
- private-schema defense-in-depth review without breaking RPC-only worker authority
- incident response and rollback procedures
- release engineering
- final public-launch security review

Do not drop indexes solely because current sparse-production statistics report them unused.

## Vercel Preview gap - resolved

Phase 7 Preview failures were caused by missing browser-safe public Supabase build configuration. The repository now supplies the public URL/publishable key only, and the subsequent Preview build completed READY with 9/9 pages prerendered.

No server/service-role secret was exposed.

## UI isolation

Dashboard V5/UI preview remains a separate active workstream. Accessibility/responsive QA belongs after that visual work is stable. Non-UI merges must not overwrite or silently integrate it.
