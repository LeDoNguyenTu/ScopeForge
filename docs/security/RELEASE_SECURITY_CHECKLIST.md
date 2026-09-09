# ScopeForge Release Security Checklist

Use this checklist for the exact release candidate and again after merge for the exact production release.

## Status semantics

- **PASS**: directly verified evidence supports the claim.
- **NOT APPLICABLE**: the control does not apply to this release and the reason is recorded.
- **NOT VERIFIED**: the state cannot be directly established. This never counts as PASS.
- **BLOCKED**: release must not proceed until resolved.

Do not turn an assumption, stale screenshot, historical deployment, uninspected provider setting, or unrelated successful test into PASS evidence.

## 1. Exact repository identity

Record:

- exact candidate commit SHA
- exact candidate Git tree
- exact base `main` SHA
- branch name
- PR number
- changed-file set
- unresolved review-thread count
- requested-change review state

A candidate is invalidated when its commit SHA or Git tree changes.

## 2. Repository validation gate

Run against the exact candidate:

```bash
npm audit --audit-level=info
npm test
npm run typecheck
npm run build:cli
node .scopeforge-build/packages/cli/index.js version
npm run benchmark:scanner
npm run benchmark:matrix
NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co \
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_example \
NEXT_PUBLIC_SITE_URL=http://localhost:3000 \
npm run build
```

Record for each command:

- status: PASS / NOT APPLICABLE / NOT VERIFIED / BLOCKED
- exact candidate SHA
- run identifier or local/isolated-run evidence
- relevant totals or result summary

Release is BLOCKED if required permanent validation fails.

## 3. Scope and changed-file review

Confirm the Phase 9E candidate contains only approved incident/release-engineering scope.

BLOCKED if the branch unexpectedly changes:

- Command Center V5 presentation source or poster assets
- `package.json` or dependency lockfile
- Supabase migrations or RLS policy implementation
- worker/runtime implementation
- hosted runtime default behavior
- scanner families or Security Pack execution
- CSP enforcement
- unrelated application features

## 4. Supabase and database evidence

Confirm the exact ScopeForge Supabase project before recording PASS.

Record:

- project identity
- project health
- current migration head and whether unexpected migration drift exists
- Supabase Security Advisor findings
- Phase 9C privilege/RLS regression evidence
- private worker-table ordinary-client access state
- privileged worker/control RPC access state for `anon`, ordinary `authenticated`, and intended trusted role
- leaked-password-protection state

Leaked-password protection may be recorded only as one of:

- **PASS - verified enabled**
- **NOT APPLICABLE - verified unavailable on the current provider/account boundary with reason**
- **NOT VERIFIED**
- **BLOCKED** when the release policy explicitly requires the control and the provider supports it but it remains off

Do not infer provider configuration from application source.

## 5. Authentication and abuse controls

Record:

- Supabase Auth native rate-limit state or directly verified provider evidence
- production Turnstile enforcement state
- CAPTCHA rollback path
- any inspected edge abuse-control state

Production Turnstile may be PASS only when the provider configuration and all protected application flows are directly verified. Otherwise record NOT VERIFIED or the exact verified disabled/pending state.

Do not claim custom Vercel WAF or rate-limit rules without direct project-specific inspection.

## 6. Vercel candidate evidence

Before merge, when a Preview is produced, record:

- exact candidate commit SHA
- Preview deployment ID
- deployment Git SHA
- READY state
- `aliasError` or equivalent alias result when exposed
- successful build/type validation evidence

The Preview Git SHA must equal the exact candidate SHA.

## 7. Merge gate

Before merge require:

- exact candidate validation remains PASS
- exact-head Preview remains READY when applicable
- no unresolved review threads
- no requested changes
- branch remains mergeable
- changed-file set remains within approved scope
- expected-head SHA is pinned in the merge operation

If the head moves, repeat candidate validation for the new exact head.

## 8. Post-merge CI and production deployment

Record:

- merged `main` SHA
- merged Git tree
- post-merge `CI / validate` run ID and conclusion
- production Vercel deployment ID
- production deployment Git SHA
- production READY state
- production alias state

Production deployment Git SHA must equal the intended merged `main` release SHA before the release is PASS.

## 9. Production HTTP and V5 preservation

Verify after deployment:

- `https://scopeforge.dev` returns HTTP 200
- accepted Command Center V5 desktop/mobile scene markers are present
- expected V5 poster assets are present
- public navigation/footer remain the released production versions
- no stale `preview/*`, `diag/*`, V4, or historical PR branch is being served as production evidence

A UI mismatch unrelated to an intentionally reviewed release is BLOCKED.

## 10. Hosted runtime authority

Directly inspect all four production capability flags:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

Expected Phase 9E state: false or absent.

Any unexpected true value is BLOCKED unless a separate reviewed runtime-enablement release explicitly authorizes it and has its own acceptance evidence.

Phase 9E is not runtime-enablement authorization.

## 11. Browser security baseline

Record the current production security-header state.

Phase 9E requirement:

- existing browser security-header baseline remains present
- CSP is not enforced by Phase 9E
- CSP state is reported truthfully as not enforced unless a separate later compatibility gate has been reviewed and released

Do not mark CSP PASS as enforced merely because other headers exist.

## 12. Edge/WAF truth

Inspect only provider controls that are actually visible through a supported current project surface.

For Vercel custom WAF, challenge, deny, or rate-limit rules, use:

- PASS only with direct project-specific evidence
- NOT VERIFIED when the surface cannot be inspected
- NOT APPLICABLE only when the control genuinely does not apply and the reason is recorded
- BLOCKED when a required verified control is missing

Do not create a rule merely to make this checklist green.

## 13. Rollback readiness

Before release record:

- known-good rollback Git SHA
- known-good Vercel deployment ID
- rollback operator procedure
- affected credential/provider rollback order when applicable
- expected runtime-flag state after rollback
- production-domain verification steps

The rollback target must be a known deployment, not a branch name alone.

## 14. Evidence privacy

Release evidence must not contain:

- passwords
- access or refresh tokens
- service-role/server keys
- worker credentials
- lease tokens
- private keys
- complete authorization headers/cookies
- raw repository source
- raw executor stdout/stderr
- complete environment dumps
- unrelated personal data

Prefer bounded counts, hashes, commit/tree SHAs, deployment IDs, migration identifiers, advisor findings, route identities, and status codes.

## 15. Final release decision

The release-state document must state one of:

- **RELEASED**: every required release blocker is clear and exact production verification passed.
- **NOT RELEASED**: candidate has not completed merge/production gates.
- **BLOCKED**: one or more required controls or validations failed.

Provider items that remain NOT VERIFIED must be listed explicitly. They must never be silently converted into PASS.

Strict CSP enforcement remains a separate compatibility gate after Phase 9E.
