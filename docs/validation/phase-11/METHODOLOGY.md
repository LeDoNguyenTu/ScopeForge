# Phase 11 adaptive validation methodology

This package evaluates the planner with a committed, deterministic two-stage legal-lab fixture. The first iteration can schedule only `lab.discovery.v1` against a repository node. Its fake provider returns a discovery observation. The next iteration consumes that observation and can schedule `lab.api-check.v1` against the newly eligible API node. A fixed scanner sequence cannot pass because the second capability has an explicit observation precondition and the test asserts both planner decisions.

The provider is an in-process test double. It makes no network requests, starts no child process, loads no target-controlled code, and receives no credentials. The fixture uses stable identifiers, timestamps, evidence references, and authorization references so repeated runs produce the same decisions and safety counters.

The harness records the required safety metrics for this corpus: out-of-scope requests, secret leakage, cleanup success, and cancellation latency. Accuracy metrics are reported only for labeled fixture cases. This small corpus is a regression guard and does not represent production vulnerability prevalence or hosted-provider capability.

Run it with:

```text
node benchmarks/pentest/run-suite.mjs
```

The command emits a JSON run manifest and exits non-zero if either adaptive assertion fails.
