# Phase 9B Provider and Edge Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add production-UI-compatible Turnstile support to ScopeForge authentication and record exact provider/edge operational gates without inventing unavailable provider state.

**Architecture:** Keep Supabase Auth as the authentication/rate-limit authority. Add a dependency-free local Turnstile wrapper that passes `options.captchaToken` directly through the existing Supabase client calls when a public site key is configured. Keep provider secret/WAF activation as explicit operational gates because the connected Cloudflare/Supabase Auth/Vercel Firewall write surfaces are unavailable.

**Tech Stack:** Next.js 15.5.24, React 19, TypeScript 5.8, Supabase JS 2.55+, Vitest 3.2, Cloudflare Turnstile explicit-render API, Vercel.

**Spec:** `docs/superpowers/specs/2026-09-08-phase-9b-provider-edge-hardening-design.md`

## Global Constraints

- Start from production docs checkpoint `fc7c4369c7075d22c3ad918bea3e17b1e1df5c2b`.
- Preserve the current production AuthForm visual structure and Phase 9A bounded auth errors.
- Do not touch PR #49 or use it as the baseline.
- Add no new npm runtime dependency.
- Never expose a Turnstile secret through `NEXT_PUBLIC_` variables, source code, logs, URLs, or browser storage.
- If `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is absent/blank, auth behavior remains unchanged.
- If a site key is configured, require a fresh challenge token before each sign-in/sign-up attempt.
- Keep Supabase native Auth rate limiting; add no custom auth limiter datastore/package.
- Do not change database/RLS/function ACLs, CSP, telemetry, WAF state claims, or hosted runtime flags.
- Supabase leaked-password protection remains blocked by the current Free organization plan; do not upgrade billing automatically.
- Use `[skip ci]` for intermediate commits. Reserve substantive Actions for a frozen release candidate.
- Keep all four hosted capability flags false/absent.

---

### Task 1: Define the Turnstile browser contract with failing tests

**Files:**
- Create: `tests/components/TurnstileChallenge.test.tsx`
- Future create: `components/auth/TurnstileChallenge.tsx`

**Interfaces:**
- Produces component contract:
  `TurnstileChallenge({ siteKey, onToken }: { siteKey: string; onToken: (token: string | null) => void })`
- The wrapper owns all `window.turnstile` lifecycle behavior.

- [ ] **Step 1: Add a test-only browser API fixture**

Define a fake `window.turnstile` with `render` and `remove` spies. `render` must capture callbacks from the options object so tests can invoke success, expiry, and error deterministically.

- [ ] **Step 2: Write failing tests**

Required tests:

```tsx
it("renders one explicit widget and emits the verified token", async () => {
  // render component, simulate script ready, assert render once,
  // invoke captured callback("token-123"), expect onToken("token-123")
});

it("clears the token when the challenge expires", async () => {
  // invoke expired-callback and expect onToken(null)
});

it("clears the token when Turnstile reports an error", async () => {
  // invoke error-callback and expect onToken(null)
});

it("removes the widget on unmount and does not duplicate it on rerender", async () => {
  // rerender same component => render remains once; unmount => remove(widgetId)
});
```

Mock `next/script` as a simple component that invokes `onLoad` and renders no external network script. Do not mock the local component.

- [ ] **Step 3: Verify RED**

Run when an executable checkout is available:

```bash
npm test -- --run tests/components/TurnstileChallenge.test.tsx
```

Expected: FAIL because `components/auth/TurnstileChallenge.tsx` does not exist.

If this harness still has no local checkout, preserve test-only ordering in Git history and state explicitly that RED is structural rather than executed.

- [ ] **Step 4: Commit test only**

```bash
git add tests/components/TurnstileChallenge.test.tsx
git commit -m "test: define Phase 9B Turnstile boundary [skip ci]"
```

---

### Task 2: Implement the dependency-free Turnstile wrapper

**Files:**
- Create: `components/auth/TurnstileChallenge.tsx`
- Test: `tests/components/TurnstileChallenge.test.tsx`

**Interfaces:**
- Consumes `siteKey` and `onToken`.
- Emits only token or null. Never sees auth credentials.

- [ ] **Step 1: Add minimal browser API types**

Use local types equivalent to:

```ts
type TurnstileOptions = {
  sitekey: string;
  callback: (token: string) => void;
  "expired-callback": () => void;
  "error-callback": () => void;
  size: "flexible";
};

type TurnstileApi = {
  render: (container: HTMLElement, options: TurnstileOptions) => string;
  remove: (widgetId: string) => void;
};
```

Extend `Window` locally rather than creating a broad global declaration file.

- [ ] **Step 2: Implement explicit rendering**

Use:

```tsx
<Script
  src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
  strategy="afterInteractive"
  onLoad={renderWidget}
/>
```

`renderWidget` must:

- return when container/API unavailable
- return if a widget ID already exists
- call `onToken(null)` before rendering a new widget
- call `window.turnstile.render(container, { sitekey: siteKey, size: "flexible", ...callbacks })`

Use refs for container and widget ID. On cleanup, call `remove` if possible and clear the stored widget ID.

- [ ] **Step 3: Run focused test GREEN**

```bash
npm test -- --run tests/components/TurnstileChallenge.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add components/auth/TurnstileChallenge.tsx tests/components/TurnstileChallenge.test.tsx
git commit -m "feat: add local Turnstile challenge wrapper [skip ci]"
```

---

### Task 3: Define AuthForm CAPTCHA behavior with failing tests

**Files:**
- Modify: `tests/components/AuthForm.test.tsx`
- Future modify: `components/AuthForm.tsx`

**Interfaces:**
- Add optional testable/public prop without changing page callers:
  `captchaSiteKey?: string | null`
- Default at runtime to `process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null`.

- [ ] **Step 1: Mock only the Turnstile wrapper boundary**

Mock `@/components/auth/TurnstileChallenge` with a small button such as `Complete security check` that calls `onToken("captcha-test-token")`.

The mock must not alter Supabase auth call behavior.

- [ ] **Step 2: Add failing configured-CAPTCHA tests**

Required assertions:

```tsx
it("preserves current sign-in behavior when no site key is configured", async () => {
  // submit immediately; expect existing Supabase call shape and bounded error behavior
});

it("requires a challenge token before configured sign-in", async () => {
  // captchaSiteKey="site-key" => submit disabled until mock challenge succeeds
});

it("passes captchaToken through password sign-in", async () => {
  expect(mocks.signInWithPassword).toHaveBeenCalledWith({
    email: "alice@example.com",
    password: "password123",
    options: { captchaToken: "captcha-test-token" }
  });
});

it("passes captchaToken and display metadata through sign-up", async () => {
  expect(mocks.signUp).toHaveBeenCalledWith({
    email: "alice@example.com",
    password: "password123",
    options: {
      data: { full_name: "Alice" },
      captchaToken: "captcha-test-token"
    }
  });
});

it("requires a fresh challenge after a failed configured attempt", async () => {
  // complete challenge, submit provider failure, then submit button becomes disabled again
});
```

Retain every Phase 9A error-bounding test.

- [ ] **Step 3: Verify RED structurally/executably**

```bash
npm test -- --run tests/components/AuthForm.test.tsx
```

Expected before implementation: configured-CAPTCHA tests fail because AuthForm has no challenge prop/token handling.

- [ ] **Step 4: Commit tests before production code**

```bash
git add tests/components/AuthForm.test.tsx
git commit -m "test: define CAPTCHA-aware auth flow [skip ci]"
```

---

### Task 4: Integrate Turnstile into the existing production AuthForm

**Files:**
- Modify: `components/AuthForm.tsx`
- Modify: `app/ui-refinement.css`
- Test: `tests/components/AuthForm.test.tsx`

**Interfaces:**
- `AuthForm({ mode, captchaSiteKey? })`
- Pages continue calling only `mode`.

- [ ] **Step 1: Add configuration and token state**

Use:

```ts
export default function AuthForm({
  mode,
  captchaSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null
}: {
  mode: "sign-in" | "sign-up";
  captchaSiteKey?: string | null;
}) {
  const normalizedCaptchaSiteKey = captchaSiteKey?.trim() || null;
  const captchaRequired = Boolean(normalizedCaptchaSiteKey);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaEpoch, setCaptchaEpoch] = useState(0);
```

- [ ] **Step 2: Require a token only when configured**

Before auth call:

```ts
if (captchaRequired && !captchaToken) {
  setMessage("Complete the security check to continue.");
  setBusy(false);
  return;
}
```

Disable the existing submit button when:

```ts
busy || (captchaRequired && !captchaToken)
```

- [ ] **Step 3: Pass the token directly to Supabase Auth**

Sign-up options:

```ts
options: {
  data: { full_name: displayName.trim() || undefined },
  ...(captchaToken ? { captchaToken } : {})
}
```

Sign-in credentials:

```ts
{
  email,
  password,
  ...(captchaToken ? { options: { captchaToken } } : {})
}
```

When no site key exists, preserve the old argument shape so existing behavior/tests do not drift unnecessarily.

- [ ] **Step 4: Invalidate one-time tokens after every non-redirecting attempt**

In the `finally` path, when CAPTCHA is configured:

```ts
setCaptchaToken(null);
setCaptchaEpoch((value) => value + 1);
```

A successful sign-in immediately navigates away. A sign-up that returns no session stays on-page and receives a fresh challenge.

- [ ] **Step 5: Render the challenge without redesigning the card**

Inside the existing `<form>` before the submit button:

```tsx
{normalizedCaptchaSiteKey && (
  <div className="authCaptcha">
    <TurnstileChallenge
      key={captchaEpoch}
      siteKey={normalizedCaptchaSiteKey}
      onToken={setCaptchaToken}
    />
  </div>
)}
```

Add only compact styling to `app/ui-refinement.css`, for example:

```css
.authCaptcha { width: 100%; min-height: 65px; display: flex; align-items: center; justify-content: center; overflow: hidden; }
.authCaptcha > * { max-width: 100%; }
```

Do not change existing card dimensions, typography, navigation, landing, dashboard, or WebGL styles.

- [ ] **Step 6: Run focused tests**

```bash
npm test -- --run tests/components/TurnstileChallenge.test.tsx tests/components/AuthForm.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add components/AuthForm.tsx app/ui-refinement.css tests/components/AuthForm.test.tsx
git commit -m "feat: pass Turnstile tokens through Supabase Auth [skip ci]"
```

---

### Task 5: Add Phase 9B architecture guard and operational truth document

**Files:**
- Create: `tests/architecture/phase-9b-provider-edge-hardening.test.ts`
- Create: `docs/security/PHASE_9B_PROVIDER_CONTROLS.md`

**Interfaces:**
- Guards provider/client security boundaries.
- Records actual versus pending platform state.

- [ ] **Step 1: Write architecture tests**

Read `components/AuthForm.tsx`, `components/auth/TurnstileChallenge.tsx`, `package.json`, and relevant Phase 9B docs.

Require:

- the public env name is exactly `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- no source text matches a public Turnstile secret such as `NEXT_PUBLIC_.*(SECRET|PRIVATE)`
- AuthForm uses `captchaToken`
- no localStorage/sessionStorage/cookie/URL persistence is used for captcha tokens
- package.json has no new Turnstile or rate-limit dependency
- no Phase 9B file references hosted runtime flags as enabled
- provider-state doc explicitly marks leaked-password protection as blocked by Free plan
- provider-state doc explicitly marks production CAPTCHA and Vercel WAF enforcement pending unless separately accepted

- [ ] **Step 2: Write the operational truth document**

Record:

```text
Supabase leaked-password protection: NOT ENABLED - current organization plan is Free.
Supabase native Auth rate limits: provider-native protection retained; exact hosted config not readable through this connector.
Turnstile-capable application code: implemented/released only after code gates pass.
Production Turnstile enforcement: PENDING until real Cloudflare site/secret + Supabase Auth provider config + Vercel public site key are jointly configured and canaried.
Vercel WAF custom rule state: NOT CLAIMED - connected surface exposes docs/deploy/logs but not firewall configuration mutation.
```

Include exact activation order and rollback order from the spec.

- [ ] **Step 3: Verify focused architecture test**

```bash
npm test -- --run tests/architecture/phase-9b-provider-edge-hardening.test.ts
```

Expected: PASS after Task 4 implementation and docs are present.

- [ ] **Step 4: Commit**

```bash
git add tests/architecture/phase-9b-provider-edge-hardening.test.ts docs/security/PHASE_9B_PROVIDER_CONTROLS.md
git commit -m "test: guard Phase 9B provider boundaries [skip ci]"
```

---

### Task 6: Checkpoint, preview, and provider preflight

**Files:**
- Modify: `docs/development/PHASE_9_WORKING_STATE.md`
- Modify: `docs/development/SESSION_HANDOFF.md`

- [ ] **Step 1: Record exact branch state**

Include test-first commit ordering, current production UI baseline, code state, and pending external provider gates.

- [ ] **Step 2: Verify branch diff scope**

Expected executable/UI file scope is limited to:

- `components/auth/TurnstileChallenge.tsx`
- `components/AuthForm.tsx`
- `app/ui-refinement.css`
- focused tests
- Phase 9B docs/spec/plan

Reject unrelated dashboard/landing/database/runtime changes.

- [ ] **Step 3: Verify exact-head Vercel Preview**

Require READY and `aliasError=null` on the exact branch head. Because CAPTCHA remains configuration-gated, Preview must continue to build even when `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is absent.

- [ ] **Step 4: Re-run live provider facts**

Require:

- ScopeForge Supabase project still `ACTIVE_HEALTHY`
- organization plan still recorded accurately
- Security Advisor state re-read
- no claim that hosted Auth CAPTCHA, leaked-password protection, or Vercel WAF is enabled without direct evidence

- [ ] **Step 5: Commit checkpoint `[skip ci]`**

---

### Task 7: Freeze and release the Turnstile-capable code

- [ ] **Step 1: Create a tree-identical freeze commit**

Message:

```text
chore: freeze Phase 9B release candidate
```

Do not add `[skip ci]` to the final freeze candidate.

- [ ] **Step 2: Require exact-head Preview READY**

- [ ] **Step 3: Open Phase 9B PR against current main**

PR body must clearly distinguish code release from provider enforcement.

- [ ] **Step 4: Run one substantive candidate CI**

Require success for:

- `npm audit --audit-level=info`
- full `npm test`
- `npm run typecheck`
- `npm run build:cli`
- CLI version
- `npm run benchmark:scanner`
- `npm run benchmark:matrix`
- `npm run build`

- [ ] **Step 5: Immutable pre-merge checks**

Re-read current `main`, PR base/head, reviews/threads, exact diff, candidate deployment, and provider facts. If current main advanced in disjoint UI files, preserve it using GitHub's merge semantics rather than rebasing/cherry-picking the legacy UI branch.

- [ ] **Step 6: Squash merge exact verified head**

Use expected head SHA.

- [ ] **Step 7: Independently verify main**

Require post-merge main CI success and exact production Vercel deployment READY on the merge SHA.

- [ ] **Step 8: Record release state**

Create `docs/development/PHASE_9B_RELEASE_STATE.md` and refresh current-state/next-steps/handoff docs with `[skip ci]`.

If external provider activation remains unavailable, state exactly:

- Turnstile-capable code: released
- production CAPTCHA enforcement: pending
- leaked-password protection: pending paid-plan capability
- Vercel WAF custom enforcement: pending supported authenticated configuration access

Then proceed to Phase 9D using the new production `main` as the integration baseline.
