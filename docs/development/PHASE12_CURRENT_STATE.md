# Phase 12 current state

Last reconciled: 2026-09-23, Asia/Singapore.

## Baseline

- Approved ScopeForge v1 roadmap: 100%.
- Phase 11 source/operational acceptance: 100%.
- Broader automated-pentest product vision: approximately 75% at Phase 12 start.
- External production provider execution remains disabled at Phase 12 start.

## Active work

12A external ProjectDiscovery httpx.

Current source work introduces a provider adapter only. It does not add network/process authority and does not enable production execution.

The adapter:

- pins provider identity to `projectdiscovery.httpx` v1.12.0
- exposes only `web.http.probe.v1`
- binds execution to an authorized target node
- permits one scheme/port profile and 0-3 redirects
- permits only reviewed metadata probes
- rejects caller URLs and provider-native flags
- emits privacy-reduced normalized observations
- keeps process/network creation outside the provider package

Next gate after adapter CI is the dedicated worker runner/image and Linux containment path.

## Storage state

Production Supabase database size observed at Phase 12 start: approximately 18 MB.

Supabase Storage objects: 0.

Production repository snapshot metadata records five R2-backed snapshots. R2 is the large/unstructured artifact plane; Postgres remains the structured system of record.

Phase 12 should continue moving large raw provider evidence/artifacts to private R2 rather than growing Postgres with blob-like payloads.
