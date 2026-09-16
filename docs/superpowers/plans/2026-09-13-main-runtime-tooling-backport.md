# Main Runtime and Tooling Backport Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Backport the already-validated Node 24, GitHub artifact-action, and Vitest ESM maintenance changes from the Phase 10A3 stack onto current `main` without changing application behavior or any blocked Phase 10A release gate.

**Architecture:** Treat this as three independent maintenance backports with separate RED -> GREEN evidence. Each backport changes only repository/tooling configuration plus an architecture regression guard. Provider configuration, Supabase schema, application authorization, scanner/runtime behavior, hosted capability flags, and PR #76/#77 release state remain untouched.

**Tech Stack:** Node.js 24 LTS, npm, GitHub Actions, Vitest 4.1.11, TypeScript 5.8, Next.js 15.5.24.

**Spec:** Previously validated maintenance contracts from PR #83, issue #81, and PR #84, reapplied to current `main` at `15323d760b00d466fd7509519c547a3e6a0b70d9`.

## Global Constraints

- Target current `main`, not PR #76 or PR #77.
- Declare Node support as `>=24 <25` and run CI with Node 24.
- Keep `@types/node` unchanged until a dedicated dependency/lockfile update is justified.
- Upgrade only the visual-artifact action major from `actions/upload-artifact@v4` to `@v7`; preserve its name, path, retention, and failure behavior.
- Move only the Vitest config to ESM; do not set root `package.json` to `type: module` because the ScopeForge CLI remains CommonJS.
- Do not change Supabase migrations, production data, GitHub App settings, provider secrets, Vercel environment variables, or hosted runtime flags.
- Do not alter PR #76/#77 operational acceptance requirements or merge state.
- Use fresh exact-head CI before integration.

---

### Task 1: Backport the Node 24 runtime contract

**Files:**
- Create: `tests/architecture/node-runtime-alignment.test.ts`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: root package metadata and CI workflow text.
- Produces: a permanent architecture guard requiring the same Node 24 contract used by Vercel and the validated stacked maintenance branch.

- [ ] **Step 1: Add the RED regression test**

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

- [ ] **Step 2: Trigger CI and verify RED**

Expected: the new architecture test fails because current `main` has no `engines.node` declaration and CI specifies Node 22. Existing tests should remain green.

- [ ] **Step 3: Add the minimal GREEN runtime changes**

Add to `package.json`:

```json
"engines": {
  "node": ">=24 <25"
}
```

Change in `.github/workflows/ci.yml`:

```yaml
node-version: 22
```

to:

```yaml
node-version: 24
```

- [ ] **Step 4: Trigger CI and verify GREEN**

Expected: installation/audit, all Vitest tests, typecheck, CommonJS CLI build/version, scanner benchmark, benchmark matrix, Next.js build, browser acceptance, and visual artifact upload all pass under Node 24.

### Task 2: Backport the supported GitHub artifact action runtime

**Files:**
- Create: `tests/architecture/ci-artifact-action-runtime.test.ts`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: CI workflow text.
- Produces: a regression guard that prevents the visual acceptance uploader from drifting back to the deprecated Node 20-backed action major.

- [ ] **Step 1: Add the RED regression test**

```ts
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("CI artifact action runtime", () => {
  it("uses upload-artifact v7 for the visual acceptance artifact", async () => {
    const workflow = await readFile(
      path.join(root, ".github/workflows/ci.yml"),
      "utf8",
    );

    expect(workflow).toContain("uses: actions/upload-artifact@v7");
    expect(workflow).not.toContain("uses: actions/upload-artifact@v4");
  });
});
```

- [ ] **Step 2: Trigger CI and verify RED**

Expected: exactly the new artifact-action guard fails because current `main` uses `actions/upload-artifact@v4`.

- [ ] **Step 3: Apply the minimal GREEN change**

Change only:

```yaml
uses: actions/upload-artifact@v4
```

to:

```yaml
uses: actions/upload-artifact@v7
```

Keep `name`, `path`, `if-no-files-found`, and `retention-days` unchanged.

- [ ] **Step 4: Trigger CI and verify GREEN**

Expected: full CI passes, the screenshot artifact is uploaded successfully, and the old Node 20 action-runtime warning is absent.

### Task 3: Backport the Vitest config ESM-local cleanup

**Files:**
- Create: `tests/architecture/vitest-config-module-format.test.ts`
- Create: `vitest.config.mts`
- Delete: `vitest.config.ts`

**Interfaces:**
- Consumes: the current Vitest configuration.
- Produces: an ESM-local Vitest config while preserving the root package and compiled CLI as CommonJS.

- [ ] **Step 1: Add the RED architecture guard**

```ts
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

async function exists(target: string): Promise<boolean> {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

describe("Vitest config module format", () => {
  it("keeps the Vitest config ESM-local without converting the whole package", async () => {
    const esmConfigPath = path.join(root, "vitest.config.mts");
    const legacyConfigPath = path.join(root, "vitest.config.ts");
    const packageJson = JSON.parse(
      await readFile(path.join(root, "package.json"), "utf8"),
    ) as { type?: string };

    expect(await exists(esmConfigPath)).toBe(true);
    expect(await exists(legacyConfigPath)).toBe(false);
    expect(packageJson.type).not.toBe("module");

    const config = await readFile(esmConfigPath, "utf8");
    expect(config).not.toContain("__dirname");
  });
});
```

- [ ] **Step 2: Trigger CI and verify RED**

Expected: only the new module-format guard fails because `vitest.config.mts` does not exist and the legacy `.ts` file still does.

- [ ] **Step 3: Apply the minimal GREEN config move**

Create `vitest.config.mts`:

```ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  oxc: {
    jsx: {
      runtime: "automatic",
      importSource: "react"
    }
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"]
  },
  resolve: {
    alias: {
      "@": root
    }
  }
});
```

Delete `vitest.config.ts`. Do not add `type: module` to `package.json`.

- [ ] **Step 4: Trigger CI and verify GREEN**

Expected: complete CI passes and the prior Vite CommonJS/ESM config warning is absent rather than suppressed.

### Task 4: Reconcile public project documentation and blocked-work handoff

**Files:**
- Modify: `README.md`
- Modify: `docs/development/CURRENT_STATE.md`
- Modify: `docs/development/NEXT_STEPS.md`

**Interfaces:**
- Consumes: exact GREEN maintenance evidence and current production/release truth.
- Produces: public setup/status documentation that no longer claims Phase 7 is pending and a handoff that explicitly separates browser-only work from tasks completed in this chat.

- [ ] **Step 1: Update README current status**

Replace the obsolete Phase 3/Phase 7 candidate wording with current released-state wording. State that Community Security Packs v1 is merged/released local-only functionality and that hosted GitHub connected-project work is present behind explicit release/runtime gates.

- [ ] **Step 2: Update README runtime requirement**

Change the quick-start requirement from `Node.js 22` to `Node.js 24` after Task 1 is GREEN.

- [ ] **Step 3: Update development handoff**

Record the maintenance branch/PR exact head and CI evidence. Keep issue #79's two live browser canaries explicitly postponed and keep PR #76/#77 release order unchanged.

### Task 5: Final integration

**Files:**
- Pull request metadata only.

**Interfaces:**
- Consumes: exact-head full GREEN CI and unchanged release-isolation review.
- Produces: current `main` aligned with the already-validated maintenance baseline without advancing blocked Phase 10A operational gates.

- [ ] **Step 1: Review changed files and ensure release isolation**

Expected changed executable/tooling files are limited to `package.json`, `.github/workflows/ci.yml`, Vitest config, and architecture tests. Documentation may also change. No application source, migration, worker, provider, or secret/configuration file should change.

- [ ] **Step 2: Run exact-head CI**

Require a fresh complete GREEN run on the final head.

- [ ] **Step 3: Merge only the verified head**

Use an expected-head SHA. Verify the resulting production deployment is healthy; because the application executable behavior is unchanged, focus on build/runtime compatibility and security-header/auth smoke rather than re-running blocked provider canaries.

- [ ] **Step 4: Resume the safe queue**

Leave #79 open with its two authenticated production browser probes documented. Continue any additional repo hygiene or UI regression work that can be evidenced without crossing that gate.
