# Phase 8A Accuracy Foundation Implementation Plan - Superseded Draft

This initial implementation-plan draft was self-reviewed before any Phase 8A production code was written and is intentionally superseded by:

`docs/superpowers/plans/2026-09-05-phase-8a-accuracy-foundation-v2.md`

The review found four specification/implementation precision issues that are corrected in v2:

1. Scanner-family/rule ownership validation belongs in the closed scanner adapter, not the generic corpus JSON parser.
2. Corpus repository identity must reject symlinks, hard links, and special files and must hash the complete validated repository tree, not only files admitted by scanner inventory/ignore rules.
3. Case evaluation and final result aggregation must be separate task boundaries; the final `ValidationAccuracyResult` cannot exist before metrics/aggregation are defined.
4. Raw counts must include every exact field used by metric tests and distinguish `error` from `unsupported` while excluding both from TP/FN/FP/TN denominators.

Do not implement from this draft. The v2 file is the authoritative Phase 8A execution plan.
