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


## Real legal-lab acceptance

Task 11 also includes a real loopback HTTP acceptance harness rather than relying only on injected provider counters. The mandatory CI target is a ScopeForge-owned test API started inside the Vitest process on an ephemeral `127.0.0.1` port. The harness performs only GET requests, uses manual redirect handling, enforces an exact-origin check before network I/O, enforces a fixed six-request ceiling, aborts a deliberately slow request, observes a controlled provider failure, and tears down all sockets at the end of the run.

The measured CI manifest is produced by:

    node benchmarks/pentest/run-legal-lab.mjs

Its release conditions require zero out-of-scope requests, zero retained secret material, successful cleanup, redirect containment, provider-failure containment, observed cancellation, and completion under the catastrophic wall-clock ceiling.

Optional containerized legal targets are defined in `tests/pentest/labs/compose.yml`. They pin OWASP Juice Shop, DVWA, and the DVWA database to explicit versions, publish only on loopback, and use an internal Docker network. They are not started by ordinary CI because Task 11 does not need a public or long-lived vulnerable service to prove the control boundary. Dedicated evaluation runners may opt into those profiles after the images are independently reviewed for that run.

These legal-lab measurements remain Task 11 evaluation evidence only. They do not enable a production provider, broaden authorization, or justify claims about global vulnerability accuracy.
