# Phase 9E Incident Readiness and Release Engineering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver repository-native security disclosure, incident response, and exact-release security gates for ScopeForge without changing V5 UI, database/runtime authority, dependencies, or provider configuration.

**Architecture:** Keep Phase 9E operational rather than product-facing. Public disclosure guidance lives in `SECURITY.md`; internal response and release procedures live under `docs/security/`; a focused architecture test makes the permanent safety claims executable; live Supabase/Vercel/GitHub evidence is recorded in a Phase 9E release-state document before exact-head integration.

**Tech Stack:** Markdown, Vitest, Node.js file reads, existing npm validation commands, GitHub, Supabase, Vercel.

**Spec:** `docs/superpowers/specs/2026-09-09-phase-9e-incident-release-engineering-design.md`

## Global Constraints

- Start from exact current production `main`; do not use stale `preview/*`, `diag/*`, V4, or prior Phase 9 branches as an implementation base.
- Preserve the accepted Command Center UI V5 presentation tree.
- Do not add dependencies.
- Do not add or modify Supabase migrations, RLS policies, scanner families, worker implementations, or hosted runtime defaults.
- Keep `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`, `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`, `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`, and `HOSTED_ACTIVE_CORS_WORKER_ENABLED` false or absent unless separately authorized.
- CSP remains not enforced in Phase 9E.
- Do not silently enable Turnstile enforcement, leaked-password protection, custom WAF rules, billing, or any other provider control.
- Provider state that cannot be directly inspected is `NOT VERIFIED`, never inferred.
- Intermediate commits use `[skip ci]`; reserve substantive CI for the exact frozen candidate and post-merge `main`.
- Branch cleanup must use genuine ref deletion. Moving stale refs to `main` is not deletion.

---

### Task 1: Add the Phase 9E documentation architecture guard

**Files:**
- Create: `tests/architecture/phase-9e-incident-release-engineering.test.ts`

**Interfaces:**
- Consumes: repository-native Phase 9E docs at fixed paths.
- Produces: executable invariants for private reporting, incident containment, evidence exclusions, exact-SHA release validation, provider truth, runtime flags, and CSP non-enforcement.

- [ ] **Step 1: Write the failing architecture test**

Create:

```ts
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const securityPolicyPath = "SECURITY.md";
const incidentRunbookPath = "docs/security/INCIDENT_RESPONSE.md";
const releaseChecklistPath = "docs/security/RELEASE_SECURITY_CHECKLIST.md";

async function read(path: string): Promise<string> {
  return readFile(path, "utf8");
}

const runtimeFlags = [
  "HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED",
  "HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED",
  "HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED",
  "HOSTED_ACTIVE_CORS_WORKER_ENABLED"
] as const;

describe("Phase 9E incident readiness and release engineering", () => {
  it("publishes a private coordinated vulnerability-reporting policy", async () => {
    const policy = await read(securityPolicyPath);
    expect(policy).toMatch(/private vulnerability reporting/i);
    expect(policy).toMatch(/GitHub private vulnerability reporting/i);
    expect(policy).toMatch(/coordinated disclosure/i);
    expect(policy).toMatch(/3 business days/i);
    expect(policy).toMatch(/5 business days/i);
    expect(policy).not.toMatch(/service[_ -]?role key|worker credential|lease token/i);
  });

  it("documents every hosted capability as an explicit containment boundary", async () => {
    const runbook = await read(incidentRunbookPath);
    for (const flag of runtimeFlags) expect(runbook).toContain(flag);
    expect(runbook).toMatch(/false or remove/i);
    expect(runbook).not.toMatch(/enable .*runtime.*(?:test|recovery)/i);
  });

  it("forbids secret and source collection during incident evidence preservation", async () => {
    const runbook = await read(incidentRunbookPath);
    for (const phrase of [
      "passwords",
      "access tokens",
      "refresh tokens",
      "service-role",
      "worker credentials",
      "lease tokens",
      "raw repository source",
      "raw executor stdout/stderr",
      "complete environment dumps"
    ]) expect(runbook.toLowerCase()).toContain(phrase.toLowerCase());
  });

  it("requires exact release evidence and permanent validation commands", async () => {
    const checklist = await read(releaseChecklistPath);
    for (const command of [
      "npm audit --audit-level=info",
      "npm test",
      "npm run typecheck",
      "npm run build:cli",
      "npm run benchmark:scanner",
      "npm run benchmark:matrix",
      "npm run build"
    ]) expect(checklist).toContain(command);
    expect(checklist).toMatch(/exact .*commit SHA/i);
    expect(checklist).toMatch(/Git tree/i);
  });

  it("does not convert unknown provider state or CSP into a passing claim", async () => {
    const checklist = await read(releaseChecklistPath);
    expect(checklist).toContain("NOT VERIFIED");
    expect(checklist).toMatch(/CSP.*not enforced/is);
    expect(checklist).not.toMatch(/CSP.*PASS.*enforced/is);
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npx vitest run tests/architecture/phase-9e-incident-release-engineering.test.ts
```

Expected: FAIL because the incident runbook and release checklist do not exist and the current minimal `SECURITY.md` does not satisfy the operational policy contract.

- [ ] **Step 3: Commit the RED test**

```bash
git add tests/architecture/phase-9e-incident-release-engineering.test.ts
git commit -m "test: pin Phase 9E operational security contract [skip ci]"
```

---

### Task 2: Expand the public vulnerability disclosure policy

**Files:**
- Modify: `SECURITY.md`

**Interfaces:**
- Consumes: Phase 9E public-reporting requirements.
- Produces: safe public vulnerability reporting and coordinated disclosure contract without sensitive operational contact data.

- [ ] **Step 1: Replace the minimal policy with the operational contract**

The document must include these exact policy elements:

```md
## Private vulnerability reporting

Use GitHub private vulnerability reporting for this repository when it is available. Do not open a public issue containing exploit details while remediation is in progress.

If GitHub private reporting is unavailable, use another private channel controlled by the repository owner. Do not send passwords, tokens, private keys, service credentials, raw production data, or unnecessary personal data.

## Response targets

- acknowledgement target: within 3 business days
- initial severity and triage target: within 5 business days after enough reproduction information is available

These are operational targets, not a paid response SLA.

## Coordinated disclosure

Please keep active exploit details private until remediation is available or a disclosure date is agreed. ScopeForge may request a reasonable remediation window based on severity and deployment impact.
```

Also preserve the existing explicit-authorization boundary for security testing and add a concise in-scope/out-of-scope reporting section.

- [ ] **Step 2: Run the focused test**

```bash
npx vitest run tests/architecture/phase-9e-incident-release-engineering.test.ts
```

Expected: still FAIL because the runbook/checklist files are not yet present, while the public-policy assertions now pass.

- [ ] **Step 3: Commit**

```bash
git add SECURITY.md
git commit -m "docs: operationalize private vulnerability reporting [skip ci]"
```

---

### Task 3: Add the incident response runbook

**Files:**
- Create: `docs/security/INCIDENT_RESPONSE.md`

**Interfaces:**
- Consumes: Phase 9E severity model, existing four runtime flags, Phase 9D telemetry/privacy rules, Supabase/Vercel deployment architecture.
- Produces: bounded incident declaration, containment, rotation, provider recovery, evidence, recovery validation, and post-incident review procedure.

- [ ] **Step 1: Write the severity table**

Include SEV-1 through SEV-4 exactly as defined by the design, with examples and escalation expectations.

- [ ] **Step 2: Write containment order**

The first-response sequence must be:

1. declare incident and preserve exact time/deployment/commit identity
2. restrict or stop affected external traffic where a verified provider control exists
3. verify all four hosted capability flags and set the affected capability to false or remove it
4. preserve bounded audit/runtime-log references
5. rotate affected credentials only after immediate containment prevents continued misuse

State explicitly that incident response must never enable a hosted capability merely to test recovery.

- [ ] **Step 3: Write credential rotation order**

Use the design order:

1. production control-plane/deployment credentials
2. Supabase server/service or database-administration credentials
3. private artifact-storage credentials
4. trusted worker credentials and lease/authentication material
5. third-party provider secrets
6. user-facing credentials only if evidence shows impact

Record secret names/categories and rotation checkpoints only, never values.

- [ ] **Step 4: Write Supabase and Vercel procedures**

Supabase section must cover session/auth containment, server-key rotation where affected, migration/schema integrity verification, RLS/privilege regression verification, Security Advisor, and recovery checks.

Vercel section must cover identifying the exact deployment SHA, rolling back/promoting only to a known-good deployment, inspecting runtime logs, applying only verified traffic controls, checking environment variables without copying secret values, and confirming the production domain after recovery.

- [ ] **Step 5: Write evidence and recovery rules**

Explicitly exclude passwords, access tokens, refresh tokens, service-role/server keys, worker credentials, lease tokens, authorization headers/cookies, raw repository source, raw executor stdout/stderr, complete environment dumps, and unrelated personal data.

Recovery validation must include production HTTP health, exact Git/deployment identity, V5 marker preservation, auth regression checks, database privilege/RLS checks, four runtime-flag checks, and renewed monitoring before closure.

- [ ] **Step 6: Run the focused test**

```bash
npx vitest run tests/architecture/phase-9e-incident-release-engineering.test.ts
```

Expected: checklist-related assertions still FAIL; runbook assertions PASS.

- [ ] **Step 7: Commit**

```bash
git add docs/security/INCIDENT_RESPONSE.md
git commit -m "docs: add Phase 9E incident response runbook [skip ci]"
```

---

### Task 4: Add the exact-release security checklist

**Files:**
- Create: `docs/security/RELEASE_SECURITY_CHECKLIST.md`

**Interfaces:**
- Consumes: permanent CI commands, Phase 9A-9D release claims, provider truth, runtime authority rules.
- Produces: repeatable exact-release gate with PASS / NOT APPLICABLE / NOT VERIFIED / BLOCKED status semantics.

- [ ] **Step 1: Define status semantics**

At the top of the checklist define:

```md
- PASS: directly verified evidence supports the claim.
- NOT APPLICABLE: the control does not apply to this release and the reason is recorded.
- NOT VERIFIED: the state cannot be directly established. This never counts as PASS.
- BLOCKED: release must not proceed until resolved.
```

- [ ] **Step 2: Add exact Git and validation gates**

Require exact candidate commit SHA, Git tree, base SHA, changed-file review, review-thread state, and these commands:

```bash
npm audit --audit-level=info
npm test
npm run typecheck
npm run build:cli
node .scopeforge-build/packages/cli/index.js version
npm run benchmark:scanner
npm run benchmark:matrix
npm run build
```

- [ ] **Step 3: Add Supabase/database gates**

Require ScopeForge project identity, migration-history sanity, Phase 9C privilege/RLS regression evidence, Security Advisor, and truthful leaked-password-protection state.

- [ ] **Step 4: Add Vercel/auth/runtime/UI gates**

Require exact-head Preview when used, exact post-merge production deployment SHA, HTTP 200 on `scopeforge.dev`, V5 marker/assets, direct edge/WAF truth only, Turnstile truth only, all four runtime flags false/absent unless separately authorized, and CSP recorded as not enforced for Phase 9E.

- [ ] **Step 5: Run focused test and verify GREEN**

```bash
npx vitest run tests/architecture/phase-9e-incident-release-engineering.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add docs/security/RELEASE_SECURITY_CHECKLIST.md
git commit -m "docs: add exact-release security gate [skip ci]"
```

---

### Task 5: Perform provider and production evidence collection

**Files:**
- Create: `docs/development/PHASE_9E_RELEASE_STATE.md`
- Modify later if exact candidate identities advance: same file

**Interfaces:**
- Consumes: live GitHub, Supabase, and Vercel read evidence.
- Produces: exact release truth without provider-state inference.

- [ ] **Step 1: Record exact branch/base/head/tree identities**

Capture current `main`, Phase 9E head, branch tree, and changed-file set.

- [ ] **Step 2: Inspect Supabase read-only state**

Verify the ScopeForge project identity, migration state relevant to Phase 9, Security Advisor, and available auth/provider settings. Record unavailable states as `NOT VERIFIED`.

Do not mutate provider configuration in this task.

- [ ] **Step 3: Inspect Vercel read-only state**

Verify the ScopeForge project, exact branch Preview deployment, deployment Git SHA, READY state, alias error, production deployment, and available directly inspectable edge/security configuration.

Record uninspectable WAF/Turnstile claims as `NOT VERIFIED` or `NOT CLAIMED`.

- [ ] **Step 4: Verify current production response and V5 preservation**

Confirm `https://scopeforge.dev` returns HTTP 200 and the expected V5 desktop/mobile scene/poster markers remain present. Do not use historical preview/diagnostic branches as evidence.

- [ ] **Step 5: Record four runtime capability states**

Directly inspect all four hosted runtime flags through the supported deployment/environment surface. Any unexpected true value is `BLOCKED` unless separately authorized.

- [ ] **Step 6: Write release-state document**

Include evidence identifiers, dates, exact SHAs, provider truth, runtime truth, remaining blockers, and rollback target. Do not claim final release until the frozen candidate validation and post-merge gates complete.

- [ ] **Step 7: Commit checkpoint**

```bash
git add docs/development/PHASE_9E_RELEASE_STATE.md
git commit -m "docs: checkpoint Phase 9E release evidence [skip ci]"
```

---

### Task 6: Full preflight, review, and frozen candidate

**Files:**
- Modify only if required by a real failure: Phase 9E docs/test files above.

**Interfaces:**
- Consumes: completed Phase 9E branch.
- Produces: one exact candidate eligible for PR validation.

- [ ] **Step 1: Run the focused Phase 9E test**

```bash
npx vitest run tests/architecture/phase-9e-incident-release-engineering.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run full repository validation locally or through an equivalent isolated runner**

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

Expected: all pass; audit reports zero vulnerabilities at or above `info`.

- [ ] **Step 3: Review the complete base-to-head diff**

Reject any drift in V5 presentation, dependencies, migrations, runtime implementations, hosted capability defaults, CSP enforcement, or unrelated security/database scope.

- [ ] **Step 4: Freeze exact candidate**

If the tree is final, create a tree-identical verification commit only if repository process requires one. Otherwise keep the exact tested head unchanged. Record exact head/tree in `PHASE_9E_RELEASE_STATE.md`.

- [ ] **Step 5: Push/update PR and move it out of draft only when frozen**

PR title:

`Phase 9E incident readiness and release engineering`

Body must include scope, exact identities, validation evidence, provider truth, runtime flags, UI preservation, and remaining non-blocking `NOT VERIFIED` provider claims.

---

### Task 7: Exact candidate CI, merge, and production release verification

**Files:**
- Modify after merge: `docs/development/PHASE_9E_RELEASE_STATE.md`, `docs/development/CURRENT_STATE.md`, `docs/development/NEXT_STEPS.md`, `docs/PHASES.md` as needed in a docs-only follow-up.

**Interfaces:**
- Consumes: exact frozen PR head.
- Produces: verified merged Phase 9E release and resumable Phase 9 closeout/CSP handoff.

- [ ] **Step 1: Require exact-head Vercel Preview READY**

Verify Preview Git SHA equals the frozen candidate and `aliasError=null` where exposed.

- [ ] **Step 2: Run one substantive exact-candidate `CI / validate`**

Do not make source changes after the run starts. If a real failure appears, fix it, create a new exact candidate, and rerun only for the new candidate.

- [ ] **Step 3: Recheck mergeability/reviews/changed files**

Require no unresolved review threads, no change requests, and no scope drift.

- [ ] **Step 4: Squash merge with expected-head protection**

Use the frozen exact head SHA. Suggested release subject:

`Phase 9E incident readiness and release engineering [skip ci]`

The explicit post-merge CI requirement still applies even if the merge subject includes `[skip ci]`; if GitHub honors the skip token and suppresses main CI, create a tree-identical verification commit without `[skip ci]` only after confirming no source/tree change is introduced.

- [ ] **Step 5: Require independent post-merge `main` validation**

Record the exact run ID/SHA and final results.

- [ ] **Step 6: Require exact production Vercel deployment READY**

Production deployment Git SHA must equal the merged `main` release SHA.

- [ ] **Step 7: Reverify production and all four runtime flags**

Confirm HTTP 200, V5 markers/assets, provider truth, and runtime flags after deployment.

- [ ] **Step 8: Commit docs-only release checkpoint**

Update the release-state/current-state/next-steps/phase docs so Phase 9E is marked complete only if no blocker remains. Strict CSP becomes the separate next compatibility gate.

Commit with `[skip ci]`, open a docs-only PR, and merge after exact changed-file review.

---

## Self-Review Result

- Spec coverage: all Phase 9E disclosure, severity, containment, credential rotation, Supabase, Vercel, evidence, recovery, exact-release, provider-truth, runtime-flag, V5-preservation, and branch-cleanup requirements map to explicit tasks.
- Placeholder scan: no TBD/TODO/"implement later" steps remain.
- Type/path consistency: the single architecture test reads the three fixed documentation paths created by Tasks 2-4; runtime flag names are identical across spec, plan, and expected test.
- Scope isolation: no task requires V5 source, dependency, migration, scanner, worker, runtime-default, or CSP-enforcement changes.