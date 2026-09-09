# Security Policy

ScopeForge is intended for defensive testing of systems the tester owns or is explicitly authorized to assess. Do not use ScopeForge against systems without clear authorization.

## Private vulnerability reporting

Use GitHub private vulnerability reporting for this repository when it is available. Do not open a public issue containing exploit details while remediation is in progress.

If GitHub private vulnerability reporting is unavailable, use another private channel controlled by the repository owner. Do not send passwords, tokens, private keys, service credentials, raw production data, or unnecessary personal data.

A useful report includes:

- the affected ScopeForge component or release
- clear reproduction steps using safe synthetic data where possible
- expected and observed behavior
- the security impact you believe is possible
- any preconditions required for exploitation

Please avoid collecting or attaching unrelated user data or production source material simply to demonstrate impact.

## Response targets

- acknowledgement target: within 3 business days
- initial severity and triage target: within 5 business days after enough reproduction information is available

These are operational targets, not a paid response SLA.

## Coordinated disclosure

Please keep active exploit details private until remediation is available or a disclosure date is agreed. ScopeForge may request a reasonable remediation window based on severity and deployment impact. Do not publish active exploit details before remediation or an agreed coordinated disclosure date.

## Scope guidance

Security reports are especially useful when they concern ScopeForge itself, including authentication or authorization boundaries, workspace isolation, scanner safety, repository acquisition, hosted worker containment, security telemetry, or deployment security.

Issues that rely only on using ScopeForge against systems without authorization are outside the intended security model. General feature requests, non-security bugs, and documentation improvements should use the normal issue workflow unless public discussion would expose an active vulnerability.

Hosted scanning and runtime features must preserve the authorization and execution guardrails documented in `docs/SECURITY.md`.
