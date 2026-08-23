# Phase 3C Secret Scanner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add ScopeForge's first real detector family with mandatory secret redaction, stable non-secret fingerprints, low-noise provider-aware detection, private-key detection, contextual entropy heuristics, and explicit allowlisting.

**Architecture:** Add an independent `scanner-secrets` package that consumes only the Phase 3A inventory and Phase 3B safe content-read boundary. Redaction and fingerprint primitives are implemented before detectors, and finding construction never receives an unredacted evidence snippet. The CLI registers the secret scanner as the first built-in scanner and validates scanner/rule configuration against a built-in registry.

**Tech Stack:** Node.js 22, TypeScript 5.8, Vitest 3.2, Node built-ins only.

**Spec:** `docs/superpowers/specs/2026-08-24-phase-3-code-supply-chain-design.md`

## Global Constraints

- Phase 3 remains local and passive.
- Never execute repository code, package lifecycle scripts, Dockerfiles, Terraform, Kubernetes manifests, or workflows.
- Never install target dependencies.
- Secret values must never appear in terminal output, native JSON, errors, logs, fingerprints, metadata, or remediation text.
- Every detector reads repository content only through `readInventoryEntry`.
- Prefer a small high-confidence rule set over broad weak regexes.
- All regexes must be bounded and free of catastrophic backtracking patterns.
- Secret scanning must remain deterministic for identical repository content/configuration.
- Existing Phase 3B exit semantics remain unchanged.

---

### Task 1: Harden bounded content reads before detectors consume them

**Files:**
- Modify: `packages/scanner-core/filesystem/read-inventory-entry.ts`
- Test: `tests/scanner/filesystem/read-inventory-entry.test.ts`

**Interfaces:**
- Consumes: `RepositoryInventory`, `ReadInventoryEntryOptions`.
- Produces: the existing `readInventoryEntry(...) -> Promise<string>` API with a hard byte cap enforced during the read, not only before it.

- [ ] **Step 1: Write a regression test for bounded reads**

Test that a file larger than `maxFileBytes` after inventory creation fails with `file_too_large` and never returns partial content. Keep the current post-inventory size-change fixture.

- [ ] **Step 2: Verify the focused suite is RED only if the current implementation permits an over-limit read path**

Run: `npm test -- tests/scanner/filesystem/read-inventory-entry.test.ts`

- [ ] **Step 3: Replace unbounded `handle.readFile` with a bounded loop**

Allocate at most `maxFileBytes + 1` bytes, read until EOF or the cap is crossed, throw `file_too_large` when more than the allowed bytes are observed, then decode only the accepted bytes as UTF-8.

- [ ] **Step 4: Run focused verification**

Run: `npm test -- tests/scanner/filesystem/read-inventory-entry.test.ts`

Expected: PASS.

---

### Task 2: Add mandatory redaction and secret fingerprint primitives

**Files:**
- Create: `packages/scanner-secrets/redaction/redact.ts`
- Create: `packages/scanner-secrets/findings/fingerprint.ts`
- Create: `tests/scanner/secrets/redaction.test.ts`
- Create: `tests/scanner/secrets/fingerprint.test.ts`

**Interfaces:**
- Produces: `redactDetectedSecret(input) -> RedactedSecretEvidence`.
- Produces: `createSecretFingerprint(input) -> string`.
- `RedactedSecretEvidence` contains only safe display text and length/provider metadata, never the raw value.
- `createSecretFingerprint` accepts the raw value only transiently, hashes it immediately, and serializes only its SHA-256 digest into the final fingerprint identity.

- [ ] **Step 1: Write RED tests proving raw values never survive redaction**

Cover GitHub-style prefixes, Stripe live prefixes, Slack prefixes, generic secrets, and private-key markers. Assert serialized evidence does not contain the full input value.

- [ ] **Step 2: Write RED fingerprint tests**

Assert deterministic `sfs1:<64 hex>` output, path normalization, line-number independence, changes when the secret changes, and no raw secret substring in the fingerprint.

- [ ] **Step 3: Implement minimal redaction**

Provider-aware redaction may preserve only a public provider prefix such as `ghp_`, `github_pat_`, `sk_live_`, or `xoxb-`. Generic secrets render as `[REDACTED]`. Private keys render only their key type/header plus a redacted marker.

- [ ] **Step 4: Implement one-way secret fingerprints**

Hash the secret value with SHA-256 first. Then hash a canonical identity containing scanner namespace, rule ID, normalized file path, sanitized structural context, and the secret digest. Do not expose the intermediate digest outside the helper.

- [ ] **Step 5: Run focused verification**

Run: `npm test -- tests/scanner/secrets/redaction.test.ts tests/scanner/secrets/fingerprint.test.ts`

Expected: PASS.

---

### Task 3: Implement high-confidence provider and private-key detectors

**Files:**
- Create: `packages/scanner-secrets/rules/types.ts`
- Create: `packages/scanner-secrets/rules/builtin.ts`
- Create: `packages/scanner-secrets/scan-file.ts`
- Create: `tests/scanner/secrets/provider-rules.test.ts`

**Interfaces:**
- Produces: versioned rule metadata with IDs:
  - `secrets/github-token`
  - `secrets/stripe-live-key`
  - `secrets/slack-token`
  - `secrets/private-key`
- Produces: `scanSecretText({ file, content, options }) -> Finding[]`.

- [ ] **Step 1: Write positive fixtures**

Cover representative GitHub PAT formats, Stripe live secret keys, Slack bot/user tokens, and PEM private-key blocks. Use synthetic tokens generated inside tests, never real credentials.

- [ ] **Step 2: Write negative fixtures**

Cover documentation placeholders, obviously repeated characters, Stripe test keys, comments containing detector examples, and short strings that resemble prefixes but do not meet minimum structure.

- [ ] **Step 3: Implement bounded deterministic matching**

Scan line-by-line with simple provider patterns. Private-key detection tracks only recognized `BEGIN ... PRIVATE KEY` headers and emits one finding at the header line. Finding evidence uses the redaction primitive only.

- [ ] **Step 4: Add explicit fixture annotation suppression**

An exact `scopeforge:allow-secret` annotation on the same line or immediately preceding line suppresses the finding. No broader region suppression is allowed.

- [ ] **Step 5: Run focused verification**

Run: `npm test -- tests/scanner/secrets/provider-rules.test.ts`

Expected: PASS.

---

### Task 4: Add contextual entropy detection without broad noise

**Files:**
- Create: `packages/scanner-secrets/entropy/shannon.ts`
- Modify: `packages/scanner-secrets/rules/builtin.ts`
- Modify: `packages/scanner-secrets/scan-file.ts`
- Create: `tests/scanner/secrets/entropy.test.ts`

**Interfaces:**
- Produces: `shannonEntropy(value: string) -> number`.
- Adds rule `secrets/high-entropy-assignment`.

- [ ] **Step 1: Write entropy unit tests**

Assert repeated strings have low entropy and mixed random-looking synthetic strings have higher entropy.

- [ ] **Step 2: Write contextual detector tests**

Only consider quoted assignment values 20-128 characters long when the key contains a security-relevant term such as `token`, `secret`, `password`, `api_key`, `apikey`, `credential`, or `private_key`. Suppress obvious `example`, `sample`, `dummy`, `placeholder`, `changeme`, repeated-character, and test-fixture values.

- [ ] **Step 3: Implement thresholded entropy detection**

Use a conservative threshold of `3.5` bits/character plus the contextual filters. Emit medium severity / medium confidence and redacted evidence.

- [ ] **Step 4: Run focused verification**

Run: `npm test -- tests/scanner/secrets/entropy.test.ts`

Expected: PASS.

---

### Task 5: Build the repository secret scanner and allowlisting

**Files:**
- Create: `packages/scanner-secrets/index.ts`
- Create: `packages/scanner-secrets/scanner.ts`
- Modify: `packages/scanner-core/config/types.ts`
- Modify: `packages/scanner-core/config/load-config.ts`
- Create: `tests/scanner/secrets/scanner.test.ts`
- Modify: `tests/scanner/config/load-config.test.ts`

**Interfaces:**
- Produces: `createSecretScanner(options) -> Scanner`.
- Produces: `SECRET_RULES` registry metadata.
- Extends config with `secrets.allowFingerprints: string[]`.

- [ ] **Step 1: Write RED scanner integration tests**

Create a temporary inventory containing multiple files, ignored files, provider secrets, a private key, and an allowlisted fingerprint. Assert findings are deterministic, ignored content is absent, and the allowlisted fingerprint is removed.

- [ ] **Step 2: Write RED configuration tests**

Assert `secrets.allowFingerprints` accepts only `sfs1:<64 hex>` values, deduplicates/sorts them, and rejects unknown `secrets` keys or malformed fingerprints.

- [ ] **Step 3: Implement the scanner**

Iterate the existing inventory only. Read each candidate through `readInventoryEntry`. Skip files containing NUL bytes. Apply rule include/exclude selection. Deduplicate by fingerprint before returning findings.

- [ ] **Step 4: Implement fingerprint allowlisting**

Filter findings only after their stable fingerprint is created. Raw values never enter configuration or output.

- [ ] **Step 5: Run focused verification**

Run: `npm test -- tests/scanner/secrets tests/scanner/config/load-config.test.ts`

Expected: PASS.

---

### Task 6: Register secrets in the CLI and prove end-to-end non-leakage

**Files:**
- Modify: `packages/cli/run-cli.ts`
- Modify: `tests/scanner/cli/run-cli.test.ts`
- Create: `tests/scanner/secrets/no-leak.test.ts`

**Interfaces:**
- Default built-in scanner set becomes `[secrets]` when `RunCliOptions.scanners` is not supplied.
- `scopeforge rules list` lists the five built-in secret rules and versions.

- [ ] **Step 1: Write RED CLI integration tests**

Scan a temporary repository containing synthetic credentials. Assert terminal output identifies findings without containing raw values. Assert JSON output contains findings, rule IDs, redacted evidence, and no raw value.

- [ ] **Step 2: Add unknown-rule fail-closed validation**

When built-in rules are active, unknown configured include/exclude rule IDs return configuration exit code `2` rather than silently reducing coverage.

- [ ] **Step 3: Register the built-in secret scanner**

Construct it after root configuration is loaded so allowlisted fingerprints and rule selection can be applied.

- [ ] **Step 4: Add a recursive serialization no-leak regression**

Serialize the entire `ScanResult`, terminal output, thrown error messages, scanner metadata, and findings. Assert none contain the synthetic raw secrets.

- [ ] **Step 5: Run full verification**

Run: `npm test`
Expected: PASS.

Run: `npm run typecheck`
Expected: PASS.

Run: `npm run build:cli`
Expected: PASS.

Run: `node .scopeforge-build/packages/cli/index.js version`
Expected: `ScopeForge 0.1.0`.

Run: `npm run build`
Expected: PASS.

---

### Task 7: Security review, docs, and merge gate

**Files:**
- Modify: `README.md`
- Modify: `docs/SECURITY.md`
- Modify: `docs/development/CURRENT_STATE.md`
- Modify: `docs/development/NEXT_STEPS.md`
- Modify: `docs/development/SESSION_HANDOFF.md`
- Modify: `docs/development/TEST_STATUS.md`
- Modify: `docs/development/IMPLEMENTATION_LOG.md`

- [ ] **Step 1: Review every changed source file for raw-secret propagation**

Trace detector match value -> fingerprint -> evidence -> finding -> coordinator -> terminal/JSON. Any path that can serialize raw values blocks merge.

- [ ] **Step 2: Review regex and resource boundaries**

Confirm simple bounded patterns, 2 MiB per-file default ceiling, no detector filesystem walks, no network access, no repository execution, and no unbounded evidence retention.

- [ ] **Step 3: Update public and resumable documentation**

State clearly which secret rules are implemented and that no SAST/SCA/IaC or remote active scanning is shipped yet.

- [ ] **Step 4: Verify the exact final PR head**

Require `npm test`, `npm run typecheck`, `npm run build:cli`, compiled CLI runtime smoke, and `npm run build` on the exact head.

- [ ] **Step 5: Merge only with no Critical/Important review blockers**

Use an expected-head squash merge so a moving branch cannot bypass the verified gate.
