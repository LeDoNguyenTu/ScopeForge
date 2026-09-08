# ScopeForge Unfinished Work Queue

Last reconciled: 2026-09-07 (Asia/Singapore)

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

Community Security Packs v1 merged through PR #54 as `1e9a72e0c4a526b064d6d3729981b405fac6b2b1`. Do not recreate Phase 7 Tasks 1-9.

## Completed - Phase 8A

Offline accuracy foundation merged through PR #55 as `8d766f5969427a2e4525f5232b5e28b0f93675bd`.

The current committed accuracy baseline is `scopeforge-offline-v1@1.0.0`: 32 reviewed cases, 8 rules, TP 16 / FN 0 / FP 0 / TN 16, errors 0, unsupported 0, contract mismatch 0. These metrics describe only the covered corpus.

Do not recreate Phase 8A.

## Completed - Phase 8B

Scanner performance matrix merged through PR #56 as `226a20739871c15d0262d1779b3b013520f47fc6` after final PR CI #760 and post-merge main CI #761 passed. Exact merge production deployment `dpl_EQUz8d1CUjszH4e2Bh8qu1VDrHCu` is READY on `scopeforge.dev`.

The matrix covers deterministic dependency/lockfile-heavy, IaC-heavy, and source/AST-heavy generated workloads with exact correctness contracts and three repeated runs each. Historical `scanner-medium-v1` remains unchanged.

Do not recreate Phase 8B.

## 1. Phase 8C - reproducible technical publication

Next non-UI implementation boundary:

- define a versioned normalized publication contract over Phase 8A/8B evidence
- publish exact commit/tool/environment provenance
- include raw TP/FN/FP/TN/error/unsupported/contract-mismatch counts and valid derived metrics
- include all benchmark runs and deterministic summaries
- include corpus/fixture identities and hashes where available
- include limitations, unsupported behavior, and known blind spots
- produce deterministic machine-readable and human-readable reports
- preserve privacy reductions and ground-truth immutability
- prevent global-accuracy claims from the 32-case corpus
- prevent catastrophic benchmark ceilings from being described as product SLOs
- keep ordinary publication local/offline and do not add runtime/network/hosted authority just to report evidence

Start by auditing existing validation/report modules and `docs/validation/METHODOLOGY.md` to avoid duplicate surfaces, then write a Phase 8C design/spec and TDD plan before implementation.

## 2. Production worker enablement - separate from code phases

### Phase 6B

Hosted GitHub acquisition remains disabled pending acquisition-worker/private-artifact operational acceptance, monitoring, rollback, and canary evidence.

### Phase 6C

Hosted zero-egress repository scanning remains disabled pending its own execution-boundary acceptance for zero egress, read-only boundaries, resource enforcement, and cancellation/container termination.

### Phase 6D

Passive and active runtime worker enablement remain separate post-merge gates. Each requires monitoring/rollback and staged canary evidence.

Do not use Phase 6D containment evidence or Phase 8 validation success as automatic authorization for 6B/6C/6D production enablement.

## 3. Phase 9 hardening/public release

Remaining non-UI items include:

- Supabase leaked-password protection warning
- threat review and abuse prevention
- Turnstile/equivalent integration if still desired and actually implemented
- observability and alerting
- private-schema defense-in-depth review without breaking RPC-only worker authority
- incident response and rollback procedures
- release engineering
- final public-launch security review

Do not drop indexes solely because sparse-production statistics report them unused.

## UI isolation

Dashboard V5/UI preview remains a separate active workstream. Accessibility/responsive QA belongs after that visual work is stable. Non-UI merges must not overwrite or silently integrate it.

## Branch cleanup

The merged Phase 8B branch remains only because the connected GitHub write surface does not expose a genuine branch delete-ref action. Do not force-move it. Preserve PR #49 and all active V5/UI branches.
