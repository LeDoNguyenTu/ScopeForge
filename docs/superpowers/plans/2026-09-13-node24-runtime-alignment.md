# Node 24 Runtime Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align ScopeForge's declared and CI-tested Node.js runtime baseline with the Vercel project's Node 24.x production/build runtime without changing the Phase 10A2/10A3 operational release gates.

**Architecture:** Keep this change limited to runtime/tooling metadata and an executable architecture regression guard. ScopeForge application behavior, scanner contracts, worker authority, provider gates, database migrations, and production environment variables remain unchanged. Use GitHub CI as the execution environment because the current sandbox cannot reach GitHub/npm directly.

**Tech Stack:** Node.js 24 LTS, npm, GitHub Actions, Vitest, TypeScript, Next.js 15.5.24.

**Spec:** GitHub issue #82 - Architecture scalability audit: Node 24 alignment and future integration seams.

## Global Constraints

- Vercel project `scopeforge` remains configured for Node `24.x`.
- GitHub CI must test the project on Node 24 LTS.
- Declare the supported application runtime as Node `>=24 <25`.
- Do not move production or CI to Node 26 Current.
- Do not change Phase 10A2/10A3 migrations, provider secrets, GitHub App settings, or hosted runtime flags.
- Do not introduce AI SDKs or change the existing provider-neutral `AdvisoryService` boundary.
- Preserve PR #77 as draft until its operational acceptance gates are satisfied.
- Any executable/configuration change after the previous PR #77 verified candidate requires fresh validation.

---

### Task 1: Add a Node runtime alignment regression guard

**Files:**
- Create: `tests/architecture/node-runtime-alignment.test.ts`
- Read: `.github/workflows/ci.yml`
- Read: `package.json`

**Interfaces:**
- Consumes: repository runtime metadata and CI workflow text.
- Produces: a deterministic Vitest guard that fails if CI drifts away from Node 24 or the package engine declaration is removed/changed.

- [ ] **Step 1: Write the failing regression test**

```ts
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("Node runtime alignment", () => {
  it("keeps the declared runtime and CI on Node 24 LTS", async () => {
    const packageJson = JSON.parse(
      await readFile(path.join(root, "package.json"), "utf8"),
    ) as { engines?: { node?: string } };
    const workflow = await readFile(
      path.join(root, ".github/workflows/ci.yml"),
      "utf8",
    );

    expect(packageJson.engines?.node).toBe(">=24 <25");
    expect(workflow).toMatch(/node-version:\s*["']?24["']?/);
    expect(workflow).not.toMatch(/node-version:\s*["']?22["']?/);
  });
});
```

- [ ] **Step 2: Run the stacked PR CI to verify RED**

Expected: exactly the new runtime-alignment test fails because `package.json` has no Node engine declaration and CI still specifies Node 22. Existing tests should otherwise retain the previous green baseline.

- [ ] **Step 3: Preserve the RED run URL/number in issue #82 or the stacked PR body**

Expected: the failure is attributable only to the new guard, not an unrelated regression.

### Task 2: Align declared runtime and CI to Node 24 LTS

**Files:**
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`
- Test: `tests/architecture/node-runtime-alignment.test.ts`

**Interfaces:**
- Consumes: Task 1 regression guard.
- Produces: Node `>=24 <25` engine metadata and Node 24 CI execution.

- [ ] **Step 1: Add the package engine declaration**

Add at the root package level:

```json
"engines": {
  "node": ">=24 <25"
}
```

Do not change dependency versions in this task. In particular, do not hand-edit `package-lock.json` to upgrade `@types/node`; dependency-lock regeneration belongs to a later change with an npm-capable workspace.

- [ ] **Step 2: Change GitHub Actions setup-node runtime**

Change only:

```yaml
node-version: 22
```

to:

```yaml
node-version: 24
```

Keep `actions/setup-node@v7`, `package-manager-cache: false`, and all validation steps unchanged.

- [ ] **Step 3: Run the complete stacked PR CI matrix**

Expected GREEN evidence:

- `npm ci --ignore-scripts --no-audit --no-fund` succeeds under Node 24
- `npm audit --audit-level=info` succeeds
- all Vitest files/tests pass, including `node-runtime-alignment.test.ts`
- `npm run typecheck` passes
- CLI build/version passes
- scanner benchmark passes its existing budget
- benchmark matrix passes existing budgets
- optimized Next.js build passes
- CSP browser smoke passes
- production UI/Turnstile diagnostic remains non-blocking and does not introduce a new product regression
- visual acceptance upload works with `actions/upload-artifact@v7`

- [ ] **Step 4: Review CI warnings for Node 24-specific incompatibilities**

Do not dismiss new deprecations, engine errors, native-module failures, or test timing regressions as unrelated without evidence.

### Task 3: Integrate the verified maintenance change without bypassing release gates

**Files:**
- Update: stacked PR description
- Update: GitHub issue #82
- Update: PR #77 description after integration

**Interfaces:**
- Consumes: exact GREEN CI evidence from Task 2.
- Produces: a traceable Node 24 baseline integrated into the Phase 10A3 branch while preserving its draft/release state.

- [ ] **Step 1: Merge the stacked maintenance PR only after complete GREEN evidence**

Target branch remains `feat/phase-10a3-github-webhook-reconciliation`, not `main`.

- [ ] **Step 2: Re-resolve the exact PR #77 branch head after merge**

Expected: a new head containing only the verified Node alignment maintenance plus the existing Phase 10A3 tree.

- [ ] **Step 3: Obtain fresh PR #77 exact-candidate validation if needed**

Because PR #77 is draft and draft synchronize events do not run the validate job, temporarily mark it ready only when needed to trigger exact-head validation, then return it to draft after the run.

- [ ] **Step 4: Update issue #82 and PR #77 with the exact SHA and CI evidence**

Record runtime alignment as completed but keep #79 and the Phase 10A2/10A3 live canaries as independent release blockers.

## Deferred Follow-up

- Upgrade `@types/node` from 22.x to 24.x only in an environment that can run npm and regenerate `package-lock.json` normally. Do not fabricate lockfile integrity data.
- Handle the Vite CommonJS/ESM config future warning as a separate tested maintenance change.
- Before adding a second SCM provider, extract a provider-neutral repository-provider port from `lib/project-scans`.
- Preserve the existing provider-neutral AI advisory boundary until a concrete AI product workflow is selected.
