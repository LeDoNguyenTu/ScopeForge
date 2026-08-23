# Privacy Baseline

ScopeForge should minimize collection of user and target data.

- Relational metadata stays workspace-scoped.
- Scanner evidence should be retained only when it supports a finding or user-selected report.
- Secrets discovered during scanning must be redacted before persistence or display.
- Large artifacts will use private object storage with short-lived access URLs.
- Public analytics are not required for the Phase 1 application.
