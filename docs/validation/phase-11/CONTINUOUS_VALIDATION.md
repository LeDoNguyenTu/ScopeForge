# Phase 11 continuous validation

Phase 11 continuous validation reuses existing trusted trigger and remediation boundaries rather than creating a second finding lifecycle.

## Trigger sources

- verified repository updates from the released Phase 10A3 webhook reconciliation path
- deployment/runtime state changes supplied by a trusted integration
- explicit schedules
- remediation retest requests

Every new Phase 11 run still requires fresh authorization. A trigger is evidence that work may be relevant, not authorization to execute it.

## Selective invalidation

Repository and runtime evidence bindings record the exact source-state reference that produced evidence. When source state changes, only bindings tied to the previous state of that source kind become stale. Their linked hypotheses and nodes are selected for re-evaluation.

A repository update must not invalidate unrelated runtime evidence. A runtime change must not invalidate unrelated repository evidence. Re-delivery of the same source-state reference schedules nothing.

Scheduled validation reconsiders eligible or blocked hypotheses but does not bypass normal planner, policy, budget, approval, or provider gates.

## Historical states

Comparison reports findings separately as:

- new
- persistent
- remediated
- recurrent
- untested

Untested is not treated as fixed. A previously verified-fixed fingerprint observed again is recurrent.

## Remediation verification

A Phase 11 observation may classify a retest only when:

- it is newer than the retest request
- it comes from the exact expected capability
- it carries authoritative evidence references
- it binds the exact finding fingerprint
- it explicitly reports whether the finding is present

Only fresh authoritative evidence with `findingPresent=false` yields a `verified_fixed` decision. Omission from a later scan, stale observations, source mismatch, or missing evidence remains inconclusive.

The existing security-remediation database finalizer remains the authority that changes canonical finding lifecycle state.

## Run and coverage diff

Continuous validation compares request count, graph expansion, provider failures, newly covered nodes, nodes no longer covered, and newly attempted capabilities. These are run-to-run measurements, not vulnerability prevalence claims.

## Safety boundary

Continuous triggers do not widen execution mode, create provider credentials, auto-approve validation/intrusive actions, or turn a failed/partial run into proof of remediation.
