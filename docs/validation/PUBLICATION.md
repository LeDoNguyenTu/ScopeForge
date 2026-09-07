# ScopeForge Technical Publication Methodology

Phase 8C publishes the accepted Phase 8A accuracy evidence and Phase 8B performance evidence without re-measuring them during report rendering.

## Source of truth

The committed machine-readable source of truth is:

`validation/publication/phase-8-release-v1.evidence.json`

The human-readable publication generated from that evidence is:

`docs/validation/reports/phase-8-release-v1.md`

Canonical JSON can be reproduced deterministically from the same evidence with the publication CLI. The evidence bundle remains separately committed so measurement provenance and publication rendering are not conflated.

## Exact provenance

The first publication records:

- repository `LeDoNguyenTu/ScopeForge`
- Phase 8A release commit `8d766f5969427a2e4525f5232b5e28b0f93675bd`
- Phase 8A release tree `aa6d94c2a35973ee2c8ccbc038d22d7de4f48cc8`
- Phase 8B executable commit `226a20739871c15d0262d1779b3b013520f47fc6`
- Phase 8B executable tree `50f17f44e770f1179ed2b40b7713e14e864958c0`
- ScopeForge version `0.1.0`
- Phase 8A corpus `scopeforge-offline-v1@1.0.0`
- corpus SHA-256 `3586e2b55cb2e20be5f19997eab7758eef0dcfb7391731b86bc1bdf9bcdd399f`
- Phase 8B CI environment Node 22.23.2 on Ubuntu 24.04.4, Linux x64

The publication does not use the later documentation commit as the executable source identity.

## Accuracy interpretation

The published Phase 8A counts are TP 16, FN 0, FP 0, TN 16, with zero error, unsupported, and contract-mismatch outcomes across the 32 reviewed cases.

Precision, recall, FPR, and F1 are recomputed from integer counts by the publication normalizer. A zero denominator remains `null` and renders as `n/a`.

These metrics describe only the committed reviewed corpus. They are not global, repository-wide, scanner-wide, production, or real-world ScopeForge accuracy claims.

Rules and ecosystems absent from the corpus remain unmeasured. Network-backed SCA/OSV advisory accuracy is not part of Phase 8A.

## Performance interpretation

The publication retains all three accepted raw runs for each Phase 8B profile:

- `dependency-lockfile-heavy-v1`
- `iac-heavy-v1`
- `source-ast-heavy-v1`

The normalizer recomputes every min/median/max summary from the raw runs and rejects a bundle whose summary or correctness contract disagrees with the retained evidence.

The historical `scanner-medium-v1` measurement is retained for continuity.

RSS delta is observational only. It is not peak RSS and is not a memory limit.

The 20,000 ms and 30,000 ms catastrophic ceilings are regression guards. They are not product latency SLOs.

## Determinism

Publication rendering has no implicit timestamp, random identifier, current-working-directory field, or environment-derived value.

For identical evidence input:

- canonical JSON serialization is byte-identical
- Markdown serialization is byte-identical
- case, rule, profile, diagnostic, limitation, and unsupported-scenario ordering is stable
- benchmark measurements are retained as exact integers
- accuracy metrics remain numbers or `null` in JSON
- Markdown metrics use fixed two-decimal percentages or `n/a`

The renderer never silently reruns environment-sensitive benchmarks.

## Privacy

The publication contract excludes fixture source, finding evidence snippets, credential values, arbitrary remediation text, environment secrets, session identifiers, and private absolute machine paths.

Tests use source/secret/path sentinels to ensure these values cannot appear in canonical JSON or Markdown.

## Authority boundary

Phase 8C is local/offline reporting infrastructure. Report generation adds no:

- Supabase access or migration
- repository acquisition authority
- hosted scanning authority
- network client or arbitrary HTTP capability
- child-process or VM execution
- browser automation
- passive or active runtime worker authority
- supervisor/control-plane authority
- dashboard V5/UI behavior

These production capability flags remain false/absent unless separately accepted operationally:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

Publication success is not runtime authorization.

## Reproduction

Install and build the exact repository revision:

```bash
npm ci
npm run build:cli
```

Render a fresh copy of the publication from committed evidence:

```bash
npm run validation:publication -- --evidence validation/publication/phase-8-release-v1.evidence.json --json phase-8-release-v1.reproduced.json --markdown phase-8-release-v1.reproduced.md
```

The original Phase 8A evidence path can be independently re-evaluated with:

```bash
npm run validation:accuracy -- --corpus validation/corpus/offline-v1 --commit 8d766f5969427a2e4525f5232b5e28b0f93675bd --json phase-8a.reproduced.json --markdown phase-8a.reproduced.md
```

The Phase 8B benchmark commands are:

```bash
npm run benchmark:scanner
npm run benchmark:matrix
```

Fresh benchmark values may differ by environment. Such fresh measurements are new evidence and must not silently replace the accepted values in `phase-8-release-v1.evidence.json`.
