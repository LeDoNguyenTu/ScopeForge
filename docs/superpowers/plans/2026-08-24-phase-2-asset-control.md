# Phase 2 Asset Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first real ScopeForge security workflow: community-facing positioning, resumable project state, workspace-scoped asset registration, proof-of-control verification, scan-job records, audit events, and abuse-aware quotas without enabling active scanning yet.

**Architecture:** Keep the Next.js/Vercel control plane responsible for authentication, UX, asset registration, and orchestration metadata. Supabase remains the source of truth with RLS-enforced workspace isolation. Asset verification uses server-generated challenges and bounded server-side verification helpers. No arbitrary network scanner or exploit logic is introduced in Phase 2.

**Tech Stack:** Next.js 15, React 19, TypeScript 5.8, Supabase Auth/PostgreSQL/RLS, Vitest, React Testing Library, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-08-24-community-platform-design.md`

## Global Constraints

- ScopeForge is developer-first, while findings and security states must remain understandable to non-security users.
- The product loop remains `Discover -> Validate -> Explain -> Connect -> Prepare -> Fix -> Verify`.
- Active scanning is not enabled in Phase 2.
- Every user-owned record is workspace-scoped.
- Exposed Supabase tables use RLS.
- Verification helpers must not create an unrestricted request proxy.
- Asset verification must distinguish verified control from ownership claims.
- Public trial features must be quota-aware from the first release.
- Large artifacts do not belong in Postgres.
- No AI/Codex/ChatGPT attribution is added to commits or repository copy.
- Every implementation session updates resumable project state documentation.

---

## Planned file map

### Repository/community state
- Modify: `README.md` - community-facing project story and product promise.
- Modify: `CONTRIBUTING.md` - contribution categories and development expectations.
- Create: `CODE_OF_CONDUCT.md` - community conduct baseline.
- Create: `docs/development/CURRENT_STATE.md` - current architecture and shipped capabilities.
- Create: `docs/development/SESSION_HANDOFF.md` - authoritative resume point.
- Create: `docs/development/NEXT_STEPS.md` - ordered next actions.
- Create: `docs/development/TEST_STATUS.md` - validation matrix.
- Create: `docs/development/IMPLEMENTATION_LOG.md` - concise phase-by-phase history.

### Testing foundation
- Modify: `package.json` - add unit/component test scripts and dev dependencies.
- Create: `vitest.config.ts` - Vitest configuration.
- Create: `tests/setup.ts` - test environment setup.

### Database and types
- Create: `supabase/migrations/20260824_phase_2_asset_control.sql` - assets, verification challenges, scan jobs, audit events, quotas, enums, indexes, RLS.
- Modify: `lib/database.types.ts` - regenerated Supabase types after migration.

### Domain logic
- Create: `lib/assets/types.ts` - asset and verification domain types.
- Create: `lib/assets/normalize-target.ts` - canonical target parsing and validation.
- Create: `lib/assets/verification.ts` - challenge generation and proof-verification primitives.
- Create: `lib/quotas/limits.ts` - plan-independent trial limits.
- Create: `lib/audit/write-audit-event.ts` - server-side audit helper.

### Product UI and actions
- Create: `app/dashboard/assets/page.tsx` - asset inventory.
- Create: `app/dashboard/assets/new/page.tsx` - registration flow.
- Create: `app/dashboard/assets/[assetId]/page.tsx` - asset details and verification state.
- Create: `app/dashboard/assets/actions.ts` - server actions for registration and verification.
- Create: `components/assets/AssetForm.tsx` - asset registration form.
- Create: `components/assets/VerificationPanel.tsx` - proof instructions and retry controls.
- Modify: `components/AppShell.tsx` - working Assets navigation.
- Modify: `app/dashboard/page.tsx` - live asset counts and Phase 2 state.

### Tests
- Create: `tests/assets/normalize-target.test.ts`.
- Create: `tests/assets/verification.test.ts`.
- Create: `tests/quotas/limits.test.ts`.
- Create: `tests/components/AssetForm.test.tsx`.

---

### Task 1: Reposition ScopeForge as a community security project and add resumable project memory

**Files:**
- Modify: `README.md`
- Modify: `CONTRIBUTING.md`
- Create: `CODE_OF_CONDUCT.md`
- Create: `docs/development/CURRENT_STATE.md`
- Create: `docs/development/SESSION_HANDOFF.md`
- Create: `docs/development/NEXT_STEPS.md`
- Create: `docs/development/TEST_STATUS.md`
- Create: `docs/development/IMPLEMENTATION_LOG.md`

**Interfaces:**
- Consumes: approved product design in `docs/superpowers/specs/2026-08-24-community-platform-design.md`.
- Produces: authoritative resume documents used by every later session and contributor.

- [ ] **Step 1: Rewrite the README opening around the community mission**

Use this product promise at the top of `README.md`:

```markdown
# ScopeForge

**Open-source application security that helps you discover vulnerabilities, understand what they could lead to, and prepare before they become incidents.**

ScopeForge is built for developers first, while making security findings understandable to anyone responsible for an application. It combines practical security testing, evidence, risk context, remediation, retesting, and community-maintained security knowledge in one workflow.

> ScopeForge is for systems you own or are explicitly authorized to assess.

## Why ScopeForge

Most security tools stop at "we found a vulnerability." ScopeForge is designed around a longer loop:

**Discover -> Validate -> Explain -> Connect -> Prepare -> Fix -> Verify**
```

Add sections for current status, long-term capabilities, community contribution areas, quick start, security/safety, roadmap, and license. Do not claim scanner capabilities that are not shipped.

- [ ] **Step 2: Establish the handoff contract**

Create `docs/development/SESSION_HANDOFF.md` with this exact structure:

```markdown
# ScopeForge Session Handoff

## Current phase
Phase 2 - Asset Control

## Last completed work
- Phase 1 foundation merged to `main`.
- Community platform design approved and merged.

## Production resources
- Domain: `scopeforge.dev`
- Supabase project: `tdgpibrepzcvdivztkta`
- Supabase region: `ap-southeast-1`
- GitHub repository: `LeDoNguyenTu/ScopeForge`

## Current architecture
Control plane: Next.js/Vercel
Structured data and auth: Supabase
Artifact storage: Cloudflare R2 planned for Phase 3
Scanner execution plane: not enabled yet

## Active implementation target
Implement workspace-scoped asset registration and proof-of-control verification without enabling active scanning.

## Database migrations applied
- `20260823180002_phase_1_identity_and_workspaces`
- `20260823180018_phase_1_optimize_rls`

## Verification status
- GitHub CI typecheck: passing
- GitHub CI production build: passing
- Supabase security advisor: no security lints after Phase 1

## Next action
Follow `docs/superpowers/plans/2026-08-24-phase-2-asset-control.md` from the first unchecked task.

## Resume protocol
1. Read this file.
2. Read `CURRENT_STATE.md`.
3. Read the current phase plan.
4. Inspect only files named by the next unchecked task unless a dependency requires more context.
5. Update this handoff before ending the session.
```

- [ ] **Step 3: Write contribution and community documents**

`CONTRIBUTING.md` must explicitly welcome contributions in these categories: code, static rules, infrastructure rules, test fixtures, vulnerability explainers, remediation recipes, preparedness checklists, framework mappings, benchmarks, documentation, UX/accessibility.

`CODE_OF_CONDUCT.md` should use the Contributor Covenant 2.1 text or a concise equivalent compatible with an open-source project.

- [ ] **Step 4: Self-check repository claims**

Run:

```bash
grep -RniE "portfolio|production-grade scanner|autonomous pentest|AI pentest" README.md docs/development CONTRIBUTING.md || true
```

Expected: no misleading portfolio positioning and no claim that unimplemented scanners already exist.

- [ ] **Step 5: Commit**

```bash
git add README.md CONTRIBUTING.md CODE_OF_CONDUCT.md docs/development
git commit -m "docs: establish community mission and project handoff"
```

---

### Task 2: Add a test harness before Phase 2 domain logic

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `tests/setup.ts`
- Create: `tests/smoke.test.ts`

**Interfaces:**
- Produces: `npm test`, `npm run test:watch`, and jsdom test environment for later tasks.

- [ ] **Step 1: Add failing smoke test**

Create `tests/smoke.test.ts`:

```ts
import { describe, expect, it } from "vitest";

describe("ScopeForge test harness", () => {
  it("runs project tests", () => {
    expect("scopeforge").toBe("scopeforge");
  });
});
```

- [ ] **Step 2: Add test dependencies and scripts**

Add dev dependencies:

```json
{
  "@testing-library/jest-dom": "^6.6.0",
  "@testing-library/react": "^16.3.0",
  "jsdom": "^26.1.0",
  "vitest": "^3.2.0"
}
```

Add scripts:

```json
{
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 3: Configure Vitest**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"]
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, ".")
    }
  }
});
```

Create `tests/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 4: Run test, typecheck, and build**

Run:

```bash
npm install --no-audit --no-fund
npm test
npm run typecheck
npm run build
```

Expected: all commands pass.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts tests
git commit -m "test: add Phase 2 test harness"
```

---

### Task 3: Add the Phase 2 asset-control database model with RLS

**Files:**
- Create: `supabase/migrations/20260824_phase_2_asset_control.sql`
- Modify: `lib/database.types.ts`

**Interfaces:**
- Produces tables: `assets`, `asset_verification_challenges`, `scan_jobs`, `audit_events`, `workspace_usage`.
- Produces enums: `asset_kind`, `asset_verification_status`, `scan_job_status`, `audit_actor_type`.

- [ ] **Step 1: Write the migration locally**

The migration must define:

```sql
create type public.asset_kind as enum ('web_application', 'api', 'repository');
create type public.asset_verification_status as enum ('unverified', 'pending', 'verified', 'failed');
create type public.scan_job_status as enum ('queued', 'blocked', 'cancelled');
create type public.audit_actor_type as enum ('user', 'system');
```

Create `assets` with at least:

```sql
id uuid primary key default gen_random_uuid(),
workspace_id uuid not null references public.workspaces(id) on delete cascade,
kind public.asset_kind not null,
name text not null,
canonical_target text not null,
hostname text,
verification_status public.asset_verification_status not null default 'unverified',
verified_at timestamptz,
verified_by uuid references auth.users(id),
created_by uuid not null references auth.users(id),
created_at timestamptz not null default now(),
updated_at timestamptz not null default now(),
unique (workspace_id, canonical_target)
```

Create `asset_verification_challenges` with challenge token hash rather than storing a reusable plaintext secret:

```sql
id uuid primary key default gen_random_uuid(),
workspace_id uuid not null references public.workspaces(id) on delete cascade,
asset_id uuid not null references public.assets(id) on delete cascade,
method text not null check (method in ('http_well_known')),
token_hash text not null,
expires_at timestamptz not null,
attempt_count integer not null default 0,
last_attempt_at timestamptz,
created_by uuid not null references auth.users(id),
created_at timestamptz not null default now()
```

Create `scan_jobs` as orchestration metadata only. In Phase 2, job creation remains blocked until later scanner phases:

```sql
id uuid primary key default gen_random_uuid(),
workspace_id uuid not null references public.workspaces(id) on delete cascade,
asset_id uuid not null references public.assets(id) on delete cascade,
status public.scan_job_status not null default 'blocked',
requested_by uuid not null references auth.users(id),
blocked_reason text not null default 'Active scanning is not enabled in Phase 2',
created_at timestamptz not null default now()
```

Create `audit_events` with append-only semantics and JSONB metadata.

Create `workspace_usage` with one row per workspace and counters for registered assets, verification attempts today, and queued jobs.

- [ ] **Step 2: Add RLS**

Enable RLS on every Phase 2 table. Use existing private membership helper functions. Policies must use `(select auth.uid())` to avoid row-by-row auth initialization warnings.

Asset read policy example:

```sql
create policy assets_select_member
on public.assets for select
to authenticated
using (private.is_workspace_member(workspace_id, (select auth.uid())));
```

Mutating asset policies must require member/admin/owner privileges according to existing role helpers. Audit events are selectable by workspace members but insertable only through server-side paths or tightly scoped policy.

- [ ] **Step 3: Apply migration to the dedicated ScopeForge Supabase project**

Use project `tdgpibrepzcvdivztkta` only.

Expected: migration succeeds.

- [ ] **Step 4: Run Supabase advisors**

Expected security result: no ERROR/WARN security lints caused by new tables or policies.

Performance warnings for never-used indexes are acceptable immediately after creation. `auth_rls_initplan` warnings are not acceptable.

- [ ] **Step 5: Regenerate TypeScript types**

Replace `lib/database.types.ts` with types generated from project `tdgpibrepzcvdivztkta`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260824_phase_2_asset_control.sql lib/database.types.ts
git commit -m "feat: add workspace-scoped asset control model"
```

---

### Task 4: Implement canonical target normalization with SSRF-oriented boundaries

**Files:**
- Create: `lib/assets/types.ts`
- Create: `lib/assets/normalize-target.ts`
- Create: `tests/assets/normalize-target.test.ts`

**Interfaces:**
- Produces: `normalizeAssetTarget(input: string, kind: AssetKind): NormalizedAssetTarget`.

Define:

```ts
export type AssetKind = "web_application" | "api" | "repository";

export type NormalizedAssetTarget = {
  canonicalTarget: string;
  hostname: string | null;
  kind: AssetKind;
};
```

- [ ] **Step 1: Write failing tests**

Create tests for canonical HTTPS targets, rejection of embedded credentials, fragments, non-HTTP schemes for web/API assets, localhost, `.local`, raw loopback/private IPv4 ranges, and malformed URLs.

Example:

```ts
import { describe, expect, it } from "vitest";
import { normalizeAssetTarget } from "@/lib/assets/normalize-target";

describe("normalizeAssetTarget", () => {
  it("normalizes a public HTTPS application", () => {
    expect(normalizeAssetTarget("https://Example.COM/", "web_application")).toEqual({
      canonicalTarget: "https://example.com",
      hostname: "example.com",
      kind: "web_application"
    });
  });

  it("rejects localhost", () => {
    expect(() => normalizeAssetTarget("http://127.0.0.1:3000", "web_application"))
      .toThrow(/private or local targets are not supported/i);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm test -- tests/assets/normalize-target.test.ts
```

Expected: FAIL because module does not exist.

- [ ] **Step 3: Implement minimal normalizer**

Implementation must:

- trim input
- parse with `URL`
- permit only `https:` for hosted remote web/API verification in Phase 2
- reject usernames/passwords
- strip trailing slash and fragments
- lowercase hostnames
- reject `localhost`, `.localhost`, `.local`, loopback IPv4, RFC1918 IPv4, link-local IPv4, `0.0.0.0`, and common metadata IP `169.254.169.254`
- leave repository normalization for a later dedicated adapter unless input is a supported public GitHub URL

Do not treat hostname-string checks as sufficient for later network requests. DNS resolution checks belong in the verifier task.

- [ ] **Step 4: Run test suite**

Expected: all target normalization tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/assets tests/assets/normalize-target.test.ts
git commit -m "feat: add safe asset target normalization"
```

---

### Task 5: Implement proof-of-control challenge generation and bounded HTTP verification

**Files:**
- Create: `lib/assets/verification.ts`
- Create: `tests/assets/verification.test.ts`

**Interfaces:**
- Produces:

```ts
createVerificationChallenge(): {
  token: string;
  tokenHash: string;
  expiresAt: Date;
}

verifyHttpWellKnownTarget(input: {
  canonicalTarget: string;
  expectedToken: string;
}): Promise<{ verified: boolean; reason: string }>;
```

- [ ] **Step 1: Write token-generation tests**

Tests must confirm token entropy, SHA-256 hashing, and expiry window.

- [ ] **Step 2: Write HTTP verifier tests using mocked fetch/DNS dependencies**

Cover:

- exact token match returns verified
- missing file returns false
- wrong token returns false
- redirect to another hostname is rejected
- DNS resolution to private/loopback/link-local address is rejected before fetch
- oversized response is rejected
- timeout becomes a safe failure reason

Do not perform live Internet requests in unit tests.

- [ ] **Step 3: Implement challenge generation**

Use `crypto.randomBytes(32).toString("base64url")` and SHA-256 hash storage. Set expiry to 30 minutes.

- [ ] **Step 4: Implement bounded verification**

The verifier must request only:

```text
<canonicalTarget>/.well-known/scopeforge-verification.txt
```

Controls:

- resolve hostname before request
- reject private, loopback, link-local, multicast, unspecified, and metadata ranges
- HTTPS only
- `redirect: "manual"`
- timeout 5 seconds using `AbortSignal.timeout(5000)`
- response body limit 4 KiB
- `Accept: text/plain`
- exact constant-time-safe token comparison where practical

- [ ] **Step 5: Run tests**

```bash
npm test -- tests/assets/verification.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/assets/verification.ts tests/assets/verification.test.ts
git commit -m "feat: add bounded asset ownership verification"
```

---

### Task 6: Add quota and audit primitives

**Files:**
- Create: `lib/quotas/limits.ts`
- Create: `tests/quotas/limits.test.ts`
- Create: `lib/audit/write-audit-event.ts`

**Interfaces:**
- Produces:

```ts
export const TRIAL_LIMITS = {
  assetsPerWorkspace: 10,
  verificationAttemptsPerAssetPerHour: 5,
  verificationAttemptsPerWorkspacePerDay: 100,
  concurrentScanJobsPerWorkspace: 0
} as const;

assertCanRegisterAsset(currentCount: number): void;
assertCanAttemptVerification(input: {
  assetAttemptsLastHour: number;
  workspaceAttemptsToday: number;
}): void;
```

- [ ] **Step 1: Write failing quota tests**

Test below-limit success and exact-limit rejection with stable error codes.

- [ ] **Step 2: Implement quota guards**

Errors should carry machine-readable codes such as `ASSET_LIMIT_REACHED` and `VERIFICATION_RATE_LIMITED` so the UI can explain them without string parsing.

- [ ] **Step 3: Implement audit helper**

`writeAuditEvent` accepts Supabase server client, workspace ID, event type, actor ID, target type/id, and safe JSON metadata. Never put verification plaintext tokens or credentials in audit metadata.

- [ ] **Step 4: Run tests and typecheck**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/quotas lib/audit tests/quotas
git commit -m "feat: add asset quotas and audit primitives"
```

---

### Task 7: Build asset registration server actions

**Files:**
- Create: `app/dashboard/assets/actions.ts`

**Interfaces:**
- Produces server actions:

```ts
registerAsset(formData: FormData): Promise<ActionResult<{ assetId: string }>>
createAssetVerificationChallenge(assetId: string): Promise<ActionResult<{ token: string; expiresAt: string }>>
verifyAsset(assetId: string, token: string): Promise<ActionResult<{ verified: boolean }>>
```

Where:

```ts
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };
```

- [ ] **Step 1: Implement authenticated workspace resolution**

Resolve current user and first/selected workspace using existing server Supabase client. Reject unauthenticated actions.

- [ ] **Step 2: Implement `registerAsset`**

Flow:

1. validate kind/name/target
2. normalize target
3. load workspace asset count
4. enforce `assetsPerWorkspace`
5. insert asset with `unverified`
6. append `asset.created` audit event
7. return new asset ID

Never trust a workspace ID supplied directly by browser form data.

- [ ] **Step 3: Implement challenge creation**

Flow:

1. load asset through RLS
2. enforce per-asset and workspace verification attempt quota
3. create plaintext token only for immediate return to authenticated user
4. store token hash and expiry
5. mark asset `pending`
6. append audit event without plaintext token

- [ ] **Step 4: Implement verification**

Flow:

1. load current unexpired challenge
2. increment attempt metadata
3. call bounded verifier
4. on success mark asset `verified`, set `verified_at`, `verified_by`
5. on failure leave state `pending` or set `failed` after expiry/attempt threshold
6. append audit event with safe failure code

- [ ] **Step 5: Run typecheck**

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/dashboard/assets/actions.ts
git commit -m "feat: add asset registration and verification actions"
```

---

### Task 8: Build the Phase 2 asset UX

**Files:**
- Create: `components/assets/AssetForm.tsx`
- Create: `components/assets/VerificationPanel.tsx`
- Create: `tests/components/AssetForm.test.tsx`
- Create: `app/dashboard/assets/page.tsx`
- Create: `app/dashboard/assets/new/page.tsx`
- Create: `app/dashboard/assets/[assetId]/page.tsx`
- Modify: `components/AppShell.tsx`

**Interfaces:**
- Consumes Phase 2 server actions.
- Produces a complete user journey from dashboard -> Assets -> Register -> Verify -> Verified state.

- [ ] **Step 1: Write the AssetForm component test**

Test accessible labels, required fields, asset-kind selector, HTTPS help text, and submit state.

Example:

```tsx
render(<AssetForm />);
expect(screen.getByLabelText(/asset name/i)).toBeRequired();
expect(screen.getByLabelText(/target url/i)).toBeRequired();
expect(screen.getByText(/systems you own or are authorized to test/i)).toBeInTheDocument();
```

- [ ] **Step 2: Implement AssetForm**

Keep the form visually consistent with the existing dark ScopeForge design system. Include clear copy explaining that registering a target does not start a scan.

- [ ] **Step 3: Implement asset inventory page**

Show name, kind, canonical target, verification state, last verified time, and CTA. Empty state must explain why target verification exists.

- [ ] **Step 4: Implement verification panel**

Show exact required path:

```text
/.well-known/scopeforge-verification.txt
```

Show the one-time plaintext token and expiration after challenge creation. Include copy-to-clipboard affordance. Explain that the file can be removed after verification and that ScopeForge stores only the challenge hash after issuance.

- [ ] **Step 5: Implement asset detail page**

Progressive disclosure sections:

- Control status
- Verification instructions
- Security testing status: `Not enabled in Phase 2`
- Audit activity summary

- [ ] **Step 6: Wire Assets navigation**

Make the Assets item in `AppShell.tsx` navigate to `/dashboard/assets` and keep active-route semantics accessible.

- [ ] **Step 7: Run tests, typecheck, build**

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add components/assets app/dashboard/assets components/AppShell.tsx tests/components
git commit -m "feat: build asset registration and verification experience"
```

---

### Task 9: Make the dashboard reflect live Phase 2 data

**Files:**
- Modify: `app/dashboard/page.tsx`

**Interfaces:**
- Consumes `assets` table and workspace membership.
- Produces live counts without enabling scans.

- [ ] **Step 1: Replace hard-coded registered asset count**

Query `assets` through RLS for the current workspace and calculate total and verified counts.

- [ ] **Step 2: Update Phase 2 dashboard cards**

Use:

- Registered assets: live total
- Verified assets: live verified total
- Open findings: `0 - scanners not enabled yet`
- Workspace isolation: `RLS`

- [ ] **Step 3: Add Phase 2 next-action CTA**

If there are no assets, show `Register your first asset` linking to `/dashboard/assets/new`.

If assets exist but none are verified, show `Verify asset control` linking to the first unverified asset.

- [ ] **Step 4: Run typecheck and build**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/page.tsx
git commit -m "feat: connect dashboard to asset control state"
```

---

### Task 10: Validate security, update project handoff, and prepare the Phase 2 PR

**Files:**
- Modify: `docs/development/CURRENT_STATE.md`
- Modify: `docs/development/SESSION_HANDOFF.md`
- Modify: `docs/development/NEXT_STEPS.md`
- Modify: `docs/development/TEST_STATUS.md`
- Modify: `docs/development/IMPLEMENTATION_LOG.md`

**Interfaces:**
- Produces: resumable Phase 2 checkpoint and evidence for merge.

- [ ] **Step 1: Run local validation**

```bash
npm test
npm run typecheck
npm run build
```

Expected: all pass.

- [ ] **Step 2: Run Supabase advisors**

Run security and performance advisors for project `tdgpibrepzcvdivztkta`.

Acceptable:
- unused-index INFO notices on new tables with no traffic.

Not acceptable:
- missing RLS
- exposed private helpers
- `auth_rls_initplan`
- mutable search_path issues in security-definer functions
- security WARN/ERROR caused by Phase 2.

- [ ] **Step 3: Verify database isolation manually**

Create or use two temporary test identities/workspaces and prove that one workspace cannot select, update, delete, challenge, or verify assets belonging to the other workspace. Remove test records afterward.

- [ ] **Step 4: Update `TEST_STATUS.md`**

Record exact results for unit tests, typecheck, production build, Supabase security advisor, Supabase performance advisor, and RLS isolation check.

- [ ] **Step 5: Update `SESSION_HANDOFF.md`**

Set:

```markdown
## Current phase
Phase 2 - Asset Control complete, pending merge/release validation

## Next action
Begin Phase 3 design for code security only after the Phase 2 PR is green and merged.
```

Also list the Phase 2 migration, new domain files, known limitations, and exact PR number once opened.

- [ ] **Step 6: Open implementation PR**

PR title:

```text
Build Phase 2 asset control
```

PR body must summarize user-facing behavior, database changes, authorization model, verification safety controls, quotas, tests, advisor results, and known limitations.

- [ ] **Step 7: Wait for GitHub CI and fix failures**

Do not merge while CI is pending or failing.

- [ ] **Step 8: Squash merge after green CI**

Squash commit title:

```text
Build Phase 2 asset control
```

Commit body:

```text
Add workspace-scoped asset registration, proof-of-control verification, quotas, auditability, community project documentation, and resumable development state without enabling active scanning.
```

- [ ] **Step 9: Reset/delete working branch as appropriate**

Keep `main` history concise and professional.

---

## Plan self-review

### Spec coverage

Phase 2 covers the prerequisites needed by the approved long-term design: community positioning, project-memory contract, workspace-scoped assets, target authorization proof, scan-job metadata, quotas, auditability, and the product UX that makes authorization explicit before scanning. Scanner capabilities, findings, Security Stories, Security Packs, R2 artifacts, and attack-path modeling remain intentionally outside this phase.

### Placeholder scan

The plan contains no TBD/TODO placeholders. Later-phase features are explicitly excluded rather than deferred with vague implementation steps.

### Type consistency

All server actions use `ActionResult<T>`. Asset kinds are consistently `web_application | api | repository`. Verification status is consistently `unverified | pending | verified | failed`. Active scan jobs remain `blocked` in Phase 2.
