# ScopeForge Test Status

| Check | Result | Evidence / notes |
|---|---|---|
| Phase 3C final checkpoint | Passing | CI #114 on `477ad71282171247e20ebaead5a05d82fcb28fc0` |
| Vitest | Passing | 23 test files, 109 tests on CI #114 |
| TypeScript strict typecheck | Passing | CI #114 |
| CLI TypeScript build | Passing | `npm run build:cli` on CI #114 |
| Compiled CLI runtime smoke | Passing | `node .scopeforge-build/packages/cli/index.js version` printed `ScopeForge 0.1.0` on CI #114 |
| Next.js production build | Passing | CI #114 |
| Secret redaction tests | Passing | provider prefixes, generic redaction, and private-key material non-leakage |
| Secret fingerprint tests | Passing | deterministic `sfs1:` identity, path normalization, secret sensitivity, no raw value in fingerprint |
| Provider rule tests | Passing | GitHub, Stripe live, Slack, complete private-key block requirement, placeholder suppression, exact fixture annotations |
| Entropy tests | Passing | contextual high-entropy assignment and low-noise filters |
| Secret scanner integration | Passing | bounded inventory reads, ignore behavior, deterministic findings, fingerprint allowlisting |
| End-to-end no-leak | Passing | terminal and native JSON do not contain the synthetic detected credential |
| Config tests | Passing | strict secret fingerprint allowlisting and existing safe configuration boundaries |
| CLI tests | Passing | secret rules list, default built-in scanner, unknown rule fail-closed behavior, prior exit/output boundaries |
| Remote active scanning | Disabled | Phase 3 remains local/passive |

## TDD and security regression evidence

- CI #96: initial Phase 3C RED. The existing 89 tests passed while the new detector contracts failed for missing modules or missing CLI registration.
- CI #100: implementation GREEN with 107 tests plus typecheck, CLI build/runtime smoke, and production build.
- CI #101: RED for private-key location metadata using multiline material length as a single-line column range. The fix bounds the location to the public header match.
- CI #113: RED for annotation scope. An inline allow annotation incorrectly suppressed the next line.
- CI #114: GREEN after previous-line suppression was restricted to standalone annotation comments. All 109 tests and all build gates passed.

## Final merge rule

PR #8 must not merge unless its exact verified head passes `npm test`, `npm run typecheck`, `npm run build:cli`, the compiled CLI runtime smoke command, and `npm run build`. Any raw-secret leakage or hostile-repository boundary regression blocks merge.
