# Phase 9A Authentication Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the confirmed post-auth open redirect and normalize browser-visible authentication failures without widening ScopeForge authority or touching the isolated Dashboard V5 stream.

**Architecture:** Add two small pure helpers under `lib/auth`: one converts untrusted `next` values into safe local return paths, and one converts raw auth failures into bounded user-facing messages. Both auth routes consume the shared return-path helper. `AuthForm` consumes the error-message helper while continuing to use the existing Supabase browser client and redirect behavior.

**Tech Stack:** Next.js 15.5.24, React 19, TypeScript 5.8, Vitest 3.2, Testing Library, Supabase JS 2.112.4 from the lockfile.

**Spec:** `docs/superpowers/specs/2026-09-08-phase-9-security-hardening-design.md`

## Global Constraints

- Work only on `feat/phase-9-security-hardening-v1`.
- Do not modify PR #49 or any Dashboard V5 branch/file.
- Do not modify `app/layout.tsx` or `package.json` in Phase 9A.
- Do not change Supabase project settings, database grants, migrations, Vercel WAF, Turnstile, CSP, or runtime worker flags in Phase 9A.
- Preserve `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`, `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`, `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`, and `HOSTED_ACTIVE_CORS_WORKER_ENABLED` as false or absent.
- Use TDD for every executable change.
- Use local/disposable verification before any substantive GitHub Actions run. Intermediate commits use `[skip ci]`.
- Do not expose raw provider errors that reveal unnecessary account or policy detail.
- Unsafe or malformed post-auth return paths fall back to `/dashboard`.
- Legitimate local paths may retain their query string and fragment.

---

## File Structure

- Create `lib/auth/return-path.ts`: pure local-return-path validation and normalization.
- Create `lib/auth/error-message.ts`: bounded auth error classification for browser display.
- Create `tests/auth/return-path.test.ts`: hostile and valid return-path cases.
- Create `tests/auth/routes.test.ts`: integration coverage for callback and confirmation redirects using mocked Supabase server auth methods.
- Create `tests/auth/error-message.test.ts`: provider-error normalization contract.
- Create `tests/components/AuthForm.test.tsx`: UI regression coverage proving raw provider text is not rendered and generic messages are used.
- Modify `app/auth/callback/route.ts`: use `safeAuthReturnPath`.
- Modify `app/auth/confirm/route.ts`: use `safeAuthReturnPath`.
- Modify `components/AuthForm.tsx`: use `authErrorMessage` instead of displaying `error.message` directly.
- Update `docs/development/PHASE_9_WORKING_STATE.md`: resumable Phase 9A checkpoint after executable work is verified.

---

### Task 1: Pure safe return-path contract

**Files:**
- Create: `tests/auth/return-path.test.ts`
- Create: `lib/auth/return-path.ts`

**Interfaces:**
- Consumes: `string | null | undefined`
- Produces: `safeAuthReturnPath(value: string | null | undefined): string`
- Fallback: `/dashboard`

- [ ] **Step 1: Write the failing return-path tests**

Create `tests/auth/return-path.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { safeAuthReturnPath } from "@/lib/auth/return-path";

describe("safeAuthReturnPath", () => {
  it.each([
    [null, "/dashboard"],
    [undefined, "/dashboard"],
    ["", "/dashboard"],
    ["dashboard", "/dashboard"],
    ["https://attacker.example/pwn", "/dashboard"],
    ["http://attacker.example/pwn", "/dashboard"],
    ["//attacker.example/pwn", "/dashboard"],
    ["/\\\\attacker.example/pwn", "/dashboard"],
    ["\\\\attacker.example/pwn", "/dashboard"],
    ["/safe\\\\evil", "/dashboard"],
    ["/%0d%0aLocation:%20https://attacker.example", "/dashboard"],
    ["/safe\u0000bad", "/dashboard"]
  ])("maps unsafe value %p to %s", (input, expected) => {
    expect(safeAuthReturnPath(input)).toBe(expected);
  });

  it.each([
    ["/dashboard", "/dashboard"],
    ["/dashboard?tab=findings", "/dashboard?tab=findings"],
    ["/dashboard/assets/abc#evidence", "/dashboard/assets/abc#evidence"],
    ["/auth/sign-in?reason=expired", "/auth/sign-in?reason=expired"]
  ])("preserves safe local value %s", (input, expected) => {
    expect(safeAuthReturnPath(input)).toBe(expected);
  });
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```bash
npx vitest run tests/auth/return-path.test.ts
```

Expected: FAIL because `@/lib/auth/return-path` does not exist.

- [ ] **Step 3: Implement the minimum safe parser**

Create `lib/auth/return-path.ts`:

```ts
const FALLBACK_AUTH_RETURN_PATH = "/dashboard";
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/;

export function safeAuthReturnPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/")) return FALLBACK_AUTH_RETURN_PATH;
  if (value.startsWith("//") || value.includes("\\")) return FALLBACK_AUTH_RETURN_PATH;
  if (CONTROL_CHARACTER.test(value)) return FALLBACK_AUTH_RETURN_PATH;

  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return FALLBACK_AUTH_RETURN_PATH;
  }

  if (CONTROL_CHARACTER.test(decoded) || decoded.includes("\\") || decoded.startsWith("//")) {
    return FALLBACK_AUTH_RETURN_PATH;
  }

  try {
    const origin = "https://scopeforge.invalid";
    const parsed = new URL(value, origin);
    if (parsed.origin !== origin) return FALLBACK_AUTH_RETURN_PATH;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return FALLBACK_AUTH_RETURN_PATH;
  }
}
```

- [ ] **Step 4: Run the focused test and confirm GREEN**

Run:

```bash
npx vitest run tests/auth/return-path.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run typecheck for the new helper**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit Task 1**

```bash
git add lib/auth/return-path.ts tests/auth/return-path.test.ts
git commit -m "fix: validate auth return paths [skip ci]"
```

---

### Task 2: Apply the safe return path to both auth routes

**Files:**
- Create: `tests/auth/routes.test.ts`
- Modify: `app/auth/callback/route.ts`
- Modify: `app/auth/confirm/route.ts`

**Interfaces:**
- Consumes: `safeAuthReturnPath(next)` from Task 1.
- Produces: successful auth redirects that always stay on the request origin.

- [ ] **Step 1: Write failing route integration tests**

Create `tests/auth/routes.test.ts` with mocked Supabase auth methods and isolated module loading:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const exchangeCodeForSession = vi.fn();
const verifyOtp = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { exchangeCodeForSession, verifyOtp }
  }))
}));

beforeEach(() => {
  exchangeCodeForSession.mockReset();
  verifyOtp.mockReset();
});

describe("auth redirect routes", () => {
  it("keeps callback success on the local origin", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    const { GET } = await import("@/app/auth/callback/route");
    const response = await GET(new Request(
      "https://scopeforge.dev/auth/callback?code=ok&next=%2Fdashboard%3Ftab%3Dfindings"
    ));
    expect(response.headers.get("location")).toBe("https://scopeforge.dev/dashboard?tab=findings");
  });

  it("blocks external callback redirects", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    const { GET } = await import("@/app/auth/callback/route");
    const response = await GET(new Request(
      "https://scopeforge.dev/auth/callback?code=ok&next=https%3A%2F%2Fattacker.example%2Fpwn"
    ));
    expect(response.headers.get("location")).toBe("https://scopeforge.dev/dashboard");
  });

  it("blocks protocol-relative confirmation redirects", async () => {
    verifyOtp.mockResolvedValue({ error: null });
    const { GET } = await import("@/app/auth/confirm/route");
    const response = await GET(new Request(
      "https://scopeforge.dev/auth/confirm?token_hash=ok&type=email&next=%2F%2Fattacker.example%2Fpwn"
    ));
    expect(response.headers.get("location")).toBe("https://scopeforge.dev/dashboard");
  });

  it("preserves existing failure redirects", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: new Error("bad code") });
    const { GET } = await import("@/app/auth/callback/route");
    const response = await GET(new Request("https://scopeforge.dev/auth/callback?code=bad"));
    expect(response.headers.get("location")).toBe("https://scopeforge.dev/auth/sign-in?error=callback");
  });
});
```

- [ ] **Step 2: Run the focused route test and confirm RED**

Run:

```bash
npx vitest run tests/auth/routes.test.ts
```

Expected: external redirect cases FAIL against the existing implementation.

- [ ] **Step 3: Modify callback route**

Use exactly this structure in `app/auth/callback/route.ts`:

```ts
import { NextResponse } from "next/server";
import { safeAuthReturnPath } from "@/lib/auth/return-path";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeAuthReturnPath(url.searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }

  return NextResponse.redirect(new URL("/auth/sign-in?error=callback", url.origin));
}
```

- [ ] **Step 4: Modify confirmation route**

Use the same helper in `app/auth/confirm/route.ts`:

```ts
import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { safeAuthReturnPath } from "@/lib/auth/return-path";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = safeAuthReturnPath(url.searchParams.get("next"));

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }

  return NextResponse.redirect(new URL("/auth/sign-in?error=confirmation", url.origin));
}
```

- [ ] **Step 5: Run route and helper tests**

Run:

```bash
npx vitest run tests/auth/return-path.test.ts tests/auth/routes.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 2**

```bash
git add app/auth/callback/route.ts app/auth/confirm/route.ts tests/auth/routes.test.ts
git commit -m "fix: keep auth redirects same-origin [skip ci]"
```

---

### Task 3: Normalize browser-visible auth failures

**Files:**
- Create: `tests/auth/error-message.test.ts`
- Create: `lib/auth/error-message.ts`
- Create: `tests/components/AuthForm.test.tsx`
- Modify: `components/AuthForm.tsx`

**Interfaces:**
- Produces: `authErrorMessage(error: unknown, mode: "sign-in" | "sign-up"): string`
- Sign-in generic message: `Unable to sign in. Check your credentials and try again.`
- Sign-up generic message: `Unable to create the account. Review your details and try again.`
- Preserve explicit rate-limit guidance without echoing raw provider text.

- [ ] **Step 1: Write failing pure error-message tests**

Create `tests/auth/error-message.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { authErrorMessage } from "@/lib/auth/error-message";

describe("authErrorMessage", () => {
  it("does not echo sign-in provider details", () => {
    expect(authErrorMessage(new Error("Invalid login credentials for user alice@example.com"), "sign-in"))
      .toBe("Unable to sign in. Check your credentials and try again.");
  });

  it("does not echo sign-up provider details", () => {
    expect(authErrorMessage(new Error("User already registered"), "sign-up"))
      .toBe("Unable to create the account. Review your details and try again.");
  });

  it("maps provider rate-limit errors to bounded retry guidance", () => {
    expect(authErrorMessage(new Error("rate limit exceeded for IP 203.0.113.7"), "sign-in"))
      .toBe("Too many authentication attempts. Try again later.");
  });

  it("handles non-Error values", () => {
    expect(authErrorMessage({ secret: "should-not-render" }, "sign-in"))
      .toBe("Unable to sign in. Check your credentials and try again.");
  });
});
```

- [ ] **Step 2: Run the pure test and confirm RED**

Run:

```bash
npx vitest run tests/auth/error-message.test.ts
```

Expected: FAIL because the helper does not exist.

- [ ] **Step 3: Implement bounded classification**

Create `lib/auth/error-message.ts`:

```ts
export type AuthFormMode = "sign-in" | "sign-up";

const RATE_LIMIT_MARKERS = ["rate limit", "too many requests", "over_request_rate_limit"];

export function authErrorMessage(error: unknown, mode: AuthFormMode): string {
  const raw = error instanceof Error ? error.message.toLowerCase() : "";
  if (RATE_LIMIT_MARKERS.some((marker) => raw.includes(marker))) {
    return "Too many authentication attempts. Try again later.";
  }

  return mode === "sign-up"
    ? "Unable to create the account. Review your details and try again."
    : "Unable to sign in. Check your credentials and try again.";
}
```

- [ ] **Step 4: Run the pure error-message tests**

Run:

```bash
npx vitest run tests/auth/error-message.test.ts
```

Expected: PASS.

- [ ] **Step 5: Write the failing AuthForm UI regression test**

Create `tests/components/AuthForm.test.tsx` using Testing Library and a mocked browser Supabase client. The key assertion must prove the raw provider string is absent:

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AuthForm from "@/components/AuthForm";

const signInWithPassword = vi.fn();
const signUp = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signInWithPassword, signUp } })
}));

beforeEach(() => {
  signInWithPassword.mockReset();
  signUp.mockReset();
});

describe("AuthForm", () => {
  it("renders a bounded sign-in error instead of raw provider detail", async () => {
    signInWithPassword.mockResolvedValue({
      error: new Error("Invalid login credentials for alice@example.com")
    });

    render(<AuthForm mode="sign-in" />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "alice@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        "Unable to sign in. Check your credentials and try again."
      );
    });
    expect(screen.queryByText(/alice@example.com/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run the UI regression and confirm RED**

Run:

```bash
npx vitest run tests/components/AuthForm.test.tsx
```

Expected: FAIL because `AuthForm` currently renders `error.message` directly.

- [ ] **Step 7: Modify AuthForm to use bounded error text**

Add:

```ts
import { authErrorMessage } from "@/lib/auth/error-message";
```

Replace the catch block with:

```ts
    } catch (error) {
      setMessage(authErrorMessage(error, mode));
    } finally {
      setBusy(false);
    }
```

Do not change the Turnstile footer in Phase 9A. Phase 9B owns the control implementation and any copy change associated with its operational state.

- [ ] **Step 8: Run auth-focused tests**

Run:

```bash
npx vitest run tests/auth/return-path.test.ts tests/auth/routes.test.ts tests/auth/error-message.test.ts tests/components/AuthForm.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Commit Task 3**

```bash
git add lib/auth/error-message.ts tests/auth/error-message.test.ts tests/components/AuthForm.test.tsx components/AuthForm.tsx
git commit -m "fix: bound browser auth errors [skip ci]"
```

---

### Task 4: Phase 9A architecture and regression guard

**Files:**
- Create: `tests/architecture/phase-9a-auth-boundary.test.ts`

**Interfaces:**
- Produces static guardrails that prevent later regressions to direct unvalidated `next` handling or raw auth error rendering.

- [ ] **Step 1: Write the guard test**

Create `tests/architecture/phase-9a-auth-boundary.test.ts`:

```ts
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const callbackPath = "app/auth/callback/route.ts";
const confirmPath = "app/auth/confirm/route.ts";
const formPath = "components/AuthForm.tsx";

describe("Phase 9A auth boundary architecture", () => {
  it.each([callbackPath, confirmPath])("uses the shared safe return-path helper in %s", async (path) => {
    const source = await readFile(path, "utf8");
    expect(source).toContain("safeAuthReturnPath");
    expect(source).not.toMatch(/const next = url\.searchParams\.get\(["']next["']\) \|\|/);
  });

  it("does not render raw auth provider messages", async () => {
    const source = await readFile(formPath, "utf8");
    expect(source).toContain("authErrorMessage(error, mode)");
    expect(source).not.toContain("error instanceof Error ? error.message");
  });
});
```

- [ ] **Step 2: Run the guard test**

Run:

```bash
npx vitest run tests/architecture/phase-9a-auth-boundary.test.ts
```

Expected: PASS after Tasks 1 to 3.

- [ ] **Step 3: Commit Task 4**

```bash
git add tests/architecture/phase-9a-auth-boundary.test.ts
git commit -m "test: guard Phase 9A auth boundary [skip ci]"
```

---

### Task 5: Verify Phase 9A broadly and record resumable state

**Files:**
- Create or modify: `docs/development/PHASE_9_WORKING_STATE.md`
- Modify only if necessary for truthful state: `docs/development/CURRENT_STATE.md`, `docs/development/NEXT_STEPS.md`, `docs/development/SESSION_HANDOFF.md`

**Interfaces:**
- Produces a resumable checkpoint before any Phase 9B/9C work begins.

- [ ] **Step 1: Run all Phase 9A focused tests**

```bash
npx vitest run tests/auth/return-path.test.ts tests/auth/routes.test.ts tests/auth/error-message.test.ts tests/components/AuthForm.test.tsx tests/architecture/phase-9a-auth-boundary.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run the full test suite**

```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Run CLI build and version smoke**

```bash
npm run build:cli
node .scopeforge-build/packages/cli/index.js --version
```

Expected: both PASS and the CLI prints its current version.

- [ ] **Step 5: Run permanent scanner regressions**

```bash
npm run benchmark:scanner
npm run benchmark:matrix
```

Expected: both PASS within their existing regression ceilings.

- [ ] **Step 6: Run dependency audit**

```bash
npm audit --audit-level=info
```

Expected: no audit finding that violates the repository's current release gate.

- [ ] **Step 7: Run production Next.js build**

```bash
npm run build
```

Expected: PASS with the existing 9 static pages generated unless the application baseline has intentionally changed elsewhere.

- [ ] **Step 8: Review the exact base-to-head diff**

The diff must be limited to:

- Phase 9 spec/plan/docs
- `lib/auth/*`
- the two auth routes
- `components/AuthForm.tsx`
- Phase 9A tests

Explicitly reject unexpected changes to:

- `app/layout.tsx`
- `package.json`
- `package-lock.json`
- Supabase migrations
- worker/runtime code
- Dashboard V5 files

- [ ] **Step 9: Write the Phase 9A working-state checkpoint**

Record:

- branch and exact head SHA
- tasks completed
- focused/full verification results
- confirmation that no provider/production settings were changed
- confirmation that the leaked-password advisor warning remains a later Phase 9 operational acceptance item
- next boundary: Phase 9C database privilege regression evidence, not Phase 9B production toggles

- [ ] **Step 10: Commit the checkpoint**

```bash
git add docs/development/PHASE_9_WORKING_STATE.md docs/development/CURRENT_STATE.md docs/development/NEXT_STEPS.md docs/development/SESSION_HANDOFF.md
git commit -m "docs: record Phase 9A auth hardening checkpoint [skip ci]"
```

Only stage the three shared development documents if they were actually changed.

---

## Phase 9A Release Decision

Phase 9A is an implementation checkpoint inside the wider Phase 9 branch. Do not enable Turnstile, change Supabase Auth settings, apply database privilege migrations, or configure Vercel WAF as part of this plan.

Before opening or updating a substantive Phase 9 PR candidate, recheck the live `main` head and PR #49 overlap. If `main` or the UI stream has advanced, reconcile only what is necessary and preserve branch isolation.
