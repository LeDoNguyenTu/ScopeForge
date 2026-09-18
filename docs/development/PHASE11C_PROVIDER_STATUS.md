# Phase 11C Provider Status

Last reconciled: 2026-09-18, Asia/Singapore. Live repository/provider state wins if newer.

## Released prerequisite

- Phase 11 Task 11 graph-expansion and approval fixture released through PR #136 at merge `1f61088af44d896a4adb215974fbc259818161da`.
- Vercel Hobby deployment filtering released through PR #137. Ordinary feature branches do not auto-deploy; `main` and explicit `vercel-preview-*` branches remain enabled.
- Provider execution threat model and dependency review released through PR #138.

## Prepared on the clean main-based provider branch

- Bounded Nmap provider contract for port discovery and service fingerprinting.
- Reviewed-template Nuclei provider contract with code-owned template profiles.
- Bounded first-party HTTP discovery provider contract.
- Unknown request fields fail closed, preventing native flags, arbitrary URLs, template paths, request bodies, and other planner-controlled escape hatches.
- Provider runners are injected interfaces. No external process, network socket, DNS resolver, HTTP client, or browser execution is added by this foundation.
- Target binding is checked against trusted `ProviderExecutionContext.targetNodeIds` before an injected runner is called.
- Result normalization emits evidence-backed observations and rejects target/profile/template drift.
- Provider observation IDs use the bounded deterministic Phase 11 SHA-256 stable-ID helper.
- Nmap normalization uses deterministic numeric port ordering rather than lexicographic identifier ordering.
- Raw provider envelopes are cardinality-bounded before normalization: Nmap 2048 records, HTTP discovery 4 records or 1 for `root-only`, and Nuclei 4096 matches.
- Empty malformed Nuclei/HTTP raw profiles fail closed before per-record iteration.
- Nuclei reviewed-template profile output is rejected if any template ID falls outside the code-owned allowlist.
- The provider dependency register was re-checked on 2026-09-18: Nmap 7.991 and Nuclei 3.11.1 remain current pins; nuclei-templates review now records v10.4.7 as the current upstream corpus observed during review.

## Intentionally not enabled

- No Nmap process runner.
- No Nuclei process runner.
- No HTTP network runner.
- No worker image changes.
- No provider binary or template corpus is vendored.
- No production environment variables or feature flags are enabled.
- No Phase 11 Supabase migration is applied.
- No planner-visible raw URL, command, shell, native flag, template path, header, body, or arbitrary provider argument is introduced.

## Release gate

Before merge:

1. exact-head full GitHub CI must pass
2. review threads must remain clear
3. PR must remain mergeable against current `main`
4. no provider runtime enablement or production schema change may appear in the final diff
5. Vercel preview is not required for this provider-contract-only branch because the released deployment policy suppresses ordinary feature-branch deployments

## Next implementation gate

After this provider foundation releases:

1. extend the existing dedicated Linux worker containment harness for Phase 11 provider execution classes
2. introduce real runners one execution class at a time behind default-off feature flags
3. resolve target node IDs to authoritative locators only inside the trusted worker boundary
4. construct reviewed argv arrays in trusted code with no shell
5. pin exact executable/template artifacts and hashes before hosted execution
6. prove cancellation, process-group cleanup, egress/target scope, resource ceilings, parser/output bounds, and evidence redaction
7. keep hosted external execution disabled until real Linux containment acceptance is recorded
