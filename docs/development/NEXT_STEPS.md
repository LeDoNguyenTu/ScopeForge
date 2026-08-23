# ScopeForge Next Steps

## Current phase: Phase 3A - Scanner Foundation

The Phase 3 design is approved and merged. Phase 3A implementation is on PR #6 and has passed the implementation and hardening CI checkpoints.

Immediate actions:

1. Confirm GitHub CI is green on the final PR #6 head after documentation updates.
2. Review the final PR diff for scanner safety, deterministic contracts, and accidental hosted-control-plane coupling.
3. Mark PR #6 ready for review.
4. Squash merge PR #6 into `main` after all gates are green.

## Phase 3B - Safe reads, configuration, policy, and CLI shell

After PR #6 merges, implement the next contract layer test-first:

- a shared bounded inventory content-read helper that revalidates root containment, regular-file status, symlink safety, and size limits before detector code reads repository content
- root-scoped versioned scanner configuration
- enabled scanner-family and rule include/exclude policy
- bounded file and scan budget configuration
- explicit `--fail-on` severity semantics
- report-only default policy
- distinct configuration, scanner-execution, and policy-gate failure semantics
- `scopeforge scan [path]` CLI shell
- terminal/native JSON output selection and output-file handling
- `scopeforge version` and `scopeforge rules list` command skeletons

Do not add detector-specific behavior before these interfaces are stable. Detector implementations must consume the shared inventory and safe-read path rather than opening repository paths independently.

## Remaining approved Phase 3 sequence

1. Secret scanner and mandatory redaction primitives.
2. JavaScript/TypeScript AST parser and first structural SAST rules.
3. Limited high-confidence JavaScript/TypeScript taint analysis.
4. Dependency inventory and OSV vulnerability enrichment.
5. CycloneDX SBOM generation independent of OSV availability.
6. Docker, Kubernetes, Terraform, GitHub Actions, and generic configuration rules.
7. Baseline engine for new/existing finding state.
8. SARIF 2.1.0 adapter and GitHub Actions example.
9. Integration, golden-output, hostile-input security, and benchmark suites.
10. Documentation and release-readiness review.
11. Optional hosted ingestion and private artifact-storage handoff only after the local contract is stable.

## Deployment prerequisites before a public hosted trial

- connect the final Vercel project to the GitHub repository
- configure the public Supabase URL/key and server-only `SUPABASE_SECRET_KEY`
- attach `scopeforge.dev` and complete DNS/TLS validation
- add Cloudflare Turnstile before opening sign-up broadly
- validate production auth redirects and asset registration on the deployed origin

## Phase boundary

Do not begin remote DAST, authenticated crawling, API fuzzing, exploit validation, generalized network scanning, or credential attacks during Phase 3. Those capabilities require later isolated-worker, explicit-scope, egress-control, budget, and cancellation designs.
