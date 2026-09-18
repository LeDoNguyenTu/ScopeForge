# Phase 11C Provider Status

Last reconciled: 2026-09-18, Asia/Singapore.

## Prepared in the current stacked provider foundation

- Bounded Nmap provider contract for port discovery and service fingerprinting.
- Reviewed-template Nuclei provider contract with code-owned template profiles.
- Bounded first-party HTTP discovery provider contract.
- Unknown request fields fail closed, preventing native flags, arbitrary URLs, template paths, request bodies, and other planner-controlled escape hatches.
- Provider runners are injected interfaces. No external process, network socket, DNS resolver, or browser execution is added by this foundation.
- Result normalization emits deterministic evidence-backed observations and rejects target/profile/template drift.
- Provider execution design and dependency/license register added.

## Intentionally not enabled

- No Nmap process runner.
- No Nuclei process runner.
- No HTTP network runner.
- No worker image changes.
- No production environment variables enabled.
- No Supabase migration.
- No Vercel-specific runtime change.

## Next implementation gate

After the Task 11 graph-policy fixture PR is released, merge/rebase this provider foundation and extend the dedicated Linux worker containment harness. Add real runners one execution class at a time, keep every provider default-off, and do not enable hosted external execution until exact binary/image digests and containment acceptance are recorded.
