# Phase 11 adaptive validation methodology

This package evaluates the planner with a committed, deterministic two-stage legal-lab fixture. The first iteration can schedule only `lab.discovery.v1` against a repository node. Its fake provider returns a discovery observation. The next iteration consumes that observation and can schedule `lab.api-check.v1` against the newly eligible API node. A fixed scanner sequence cannot pass because the second capability has an explicit observation precondition and the test asserts both planner decisions.

The provider is an in-process test double. It makes no network requests, starts no child process, loads no target-controlled code, and receives no credentials. The fixture uses stable identifiers, timestamps, evidence references, and authorization references so repeated runs produce the same decisions and safety counters.

The matrix also checks replay-stable planning and deterministic pre-execution containment for cancellation, authorization expiry, request budget exhaustion, and provider failure. The fixture models no finding labels, so recall, precision, duplicate/correlation rate, attack-path correctness, and remediation retest accuracy remain intentionally unreported. This small corpus is a regression guard and does not represent production vulnerability prevalence or hosted-provider capability.

The matrix has a 5-second catastrophic wall-clock ceiling. It blocks a severe local regression in this narrow fixture; it is not a production SLO or a resource-isolation claim.

Run it with:

```text
node benchmarks/pentest/run-suite.mjs
node benchmarks/pentest/run-matrix.mjs
```

Each command emits a JSON run manifest and exits non-zero if its adaptive assertions or ceiling fail.
