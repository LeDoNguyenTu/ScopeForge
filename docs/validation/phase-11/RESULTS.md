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
