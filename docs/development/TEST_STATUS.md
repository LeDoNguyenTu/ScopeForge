# ScopeForge Test Status

| Check | Result | Evidence / notes |
|---|---|---|
| Phase 3C implementation checkpoint | Passing | CI #100 on `e67faf11f71fe53931b0f4038ae4d2404892b2ba` |
| Vitest | Passing | 23 test files, 107 tests on CI #100 |
| TypeScript strict typecheck | Passing | CI #100 |
| CLI TypeScript build | Passing | `npm run build:cli` on CI #100 |
| Compiled CLI runtime smoke | Passing | `node .scopeforge-build/packages/cli/index.js version` printed `ScopeForge 0.1.0` on CI #100 |
| Next.js production build | Passing | CI #100 |
| Secret redaction tests | Passing | provider prefixes, generic redaction, and private-key material non-leakage |
| Secret fingerprint tests | Passing | deterministic `sfs1:` identity, path normalization, secret sensitivity, no raw value in fingerprint |
| Provider rule tests | Passing before final location regression | GitHub, Stripe live, Slack, private-key, placeholder suppression, fixture annotations |
| Entropy tests | Passing | contextual high-entropy assignment and low-noise filters |
| Secret scanner integration | Passing | bounded inventory reads, ignore behavior, deterministic findings, fingerprint allowlisting |
| End-to-end no-leak | Passing | terminal and native JSON do not contain the synthetic detected credential |
| Config tests | Passing | strict secret fingerprint allowlisting and existing safe configuration boundaries |
| CLI tests | Passing | secret rules list, default built-in scanner, unknown rule fail-closed behavior, prior exit/output boundaries |
| Private-key location regression | RED then fixed | CI #101 reproduced multiline key length being used as a single-line `endColumn`; fix now anchors to header length |
| Remote active scanning | Disabled | Phase 3 remains local/passive |

## TDD and security regression evidence

- CI #96: initial Phase 3C RED. The existing 89 tests passed while the new detector contracts failed for missing modules or missing CLI registration.
- CI #100: implementation GREEN with 107 tests plus typecheck, CLI build/runtime smoke, and production build.
- CI #101: review RED for private-key location metadata. The finding was anchored to the header line but `endColumn` used full multiline key-material length.
- The fix introduces a separate bounded location length while retaining the full private-key block only transiently for fingerprint identity.

## Final merge rule

PR #8 must not merge until its exact final documentation head passes `npm test`, `npm run typecheck`, `npm run build:cli`, the compiled CLI runtime smoke command, and `npm run build`. Any raw-secret leakage or hostile-repository boundary regression blocks merge.
