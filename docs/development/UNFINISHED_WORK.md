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

## Completed - Phase 7

Community Security Packs v1 merged through PR #54 as `1e9a72e0c4a526b064d6d3729981b405fac6b2b1` after final CI #756 passed. Do not resume or recreate Phase 7 Tasks 1-9.

## 1. Phase 8 - broader validation/public methodology

Methodology foundation PR #50 is already merged. Remaining work:

- vulnerable/ground-truth labs
- deterministic evaluation contracts and regression corpus
- measurable precision/recall/false-positive tracking where valid
- reproducible scanner benchmark methodology
- transparent limitations documentation
- technical validation reports

Start by auditing the existing Phase 8 foundation and current branches/PRs to avoid duplicate work.

## 2. Production worker enablement - separate from code phases

### Phase 6B

Hosted GitHub acquisition remains disabled pending acquisition-worker/private-artifact operational acceptance, monitoring, rollback, and canary evidence.

### Phase 6C

Hosted zero-egress repository scanning remains disabled pending its own real execution-boundary acceptance for zero egress, read-only boundaries, resource enforcement, and cancellation/container termination.

### Phase 6D

Passive and active runtime worker enablement remain separate post-merge gates. Each requires source/image identity, monitoring/rollback, staged canary evidence, and existing authorization/network-safety controls.

Do not use Phase 6D containment evidence as automatic authorization for 6B or 6C.

## 3. Phase 9 hardening/public release

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

## UI isolation

Dashboard V5/UI preview remains a separate active workstream. Accessibility/responsive QA belongs after that visual work is stable. Non-UI merges must not overwrite or silently integrate it.
