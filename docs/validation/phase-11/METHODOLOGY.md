# Phase 11 adaptive validation methodology

This package evaluates the planner with a committed, deterministic two-stage legal-lab fixture. The first iteration can schedule only `lab.discovery.v1` against a repository node. Its fake provider returns a discovery observation. The next iteration consumes that observation and can schedule `lab.api-check.v1` against the newly eligible API node. A fixed scanner sequence cannot pass because the second capability has an explicit observation precondition and the test asserts both planner decisions.

The provider is an in-process test double. It makes no network requests, starts no child process, loads no target-controlled code, and receives no credentials. The fixture uses stable identifiers, timestamps, evidence references, and authorization references so repeated runs produce the same decisions and safety counters.

The matrix also checks replay-stable planning and deterministic pre-execution containment for cancellation, authorization expiry, request budget exhaustion, and provider failure.

A second committed fixture adds four explicit labels: two fictional vulnerable cases and two clean cases. It derives TP/FN/FP/TN counts through the existing offline accuracy metric helper, then measures precision, recall, false-positive rate, F1, validated-finding rate, and duplicate/correlation rate. The fixture also constructs an evidence-backed graph containing the expected `entrypoint -> API -> data` path, derives that path through the normal graph helper, and checks two remediation-retest expectations: a fixed case has no finding and a still-vulnerable case retains a finding. Repeating the whole fixture must produce exactly the same result.

The corpus is deliberately small and synthetic. Its values describe only this committed fixture: they are a regression guard, not global ScopeForge accuracy, a hosted-provider capability claim, production schema readiness, or evidence of external scanning.

The matrix has a 5-second catastrophic wall-clock ceiling. It blocks a severe local regression in this narrow fixture; it is not a production SLO or a resource-isolation claim.

Run it with:

```text
node benchmarks/pentest/run-suite.mjs
node benchmarks/pentest/run-matrix.mjs
node benchmarks/pentest/run-labeled.mjs
```

Each command emits a JSON run manifest and exits non-zero if its adaptive assertions or ceiling fail.
