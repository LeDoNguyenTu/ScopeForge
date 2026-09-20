# Phase 11 adaptive validation results

Measured locally on 2026-09-18 from the released `main` base, with Node 24 and one Vitest worker:

```json
{
  "suite": "phase-11-adaptive-planner-fixture",
  "passed": true,
  "testFiles": 1,
  "tests": 2,
  "outOfScopeRequests": 0,
  "leakedSecrets": 0,
  "cleanupSucceeded": true,
  "cancellationLatencyMs": 0,
  "elapsedMs": 1864
}
```

The first planner iteration scheduled discovery and the second scheduled the API capability only after the discovery observation was supplied. This is fixture-level evidence; it is not evidence of hosted provider execution, production schema readiness, or broad vulnerability recall.

## Evaluation matrix

Measured locally on 2026-09-18 with Node 24 and one Vitest worker:

```json
{
  "suite": "phase-11-adaptive-planner-matrix",
  "passed": true,
  "testFiles": 2,
  "tests": 5,
  "elapsedMs": 1929,
  "catastrophicCeilingMs": 5000,
  "discoveryRequired": true,
  "replayStable": true,
  "stopReasons": [
    "cancelled",
    "authorization_expired",
    "request_budget_exhausted",
    "provider_failure_limit"
  ],
  "outOfScopeRequests": 0,
  "leakedSecrets": 0,
  "cleanupSucceeded": true,
  "cancellationLatencyMs": 0
}
```

The matrix validates pre-execution containment against the committed fake provider. It does not report unmeasured vulnerability accuracy or live/provider/container behavior.

## Labeled evaluation fixture

Measured locally on 2026-09-18 with Node 24 and one Vitest worker:

```json
{
  "suite": "phase-11-labeled-adaptive-evaluation",
  "passed": true,
  "testFiles": 1,
  "tests": 2,
  "elapsedMs": 1661,
  "catastrophicCeilingMs": 5000,
  "precision": 0.6666666666666666,
  "recall": 1,
  "falsePositiveRate": 0.5,
  "f1": 0.8,
  "validatedFindingRate": 0.6666666666666666,
  "duplicateCorrelationRate": 0.25,
  "attackPathCorrect": true,
  "remediationRetestAccuracy": 1,
  "outOfScopeRequests": 0,
  "leakedSecrets": 0,
  "cleanupSucceeded": true,
  "cancellationLatencyMs": 0
}
```

The counts are two true positives, zero false negatives, one false positive, and one true negative in a four-label synthetic fixture. One duplicate correlation key appears among four raw reported results. The expected provenance-backed `entrypoint -> API -> data` path is present, and both synthetic remediation retests are classified correctly. These values are limited to the committed fixture and do not characterize production coverage, provider behavior, or the prevalence of vulnerabilities.


## Task 11 legal-lab harness acceptance

The Task 11 closure slice adds regression-tested lab definitions and an executable first-party loopback API fixture. The normal test suite verifies pinned third-party identities, loopback-only publication, an internal container network, no published DVWA database port, the first-party discovery contract, and a deterministic external-redirect fixture.

No Juice Shop or DVWA vulnerability result is recorded here because the current Task 11 closure does not run external providers against them. Provider-specific lab measurements belong to the separately reviewed provider gates and must be added only after those runs occur.
