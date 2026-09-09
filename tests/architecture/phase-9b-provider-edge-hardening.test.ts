import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const authFormPath = "components/AuthForm.tsx";
const turnstilePath = "components/auth/TurnstileChallenge.tsx";
const packagePath = "package.json";
const providerStatePath = "docs/security/PHASE_9B_PROVIDER_CONTROLS.md";

async function read(path: string): Promise<string> {
  return readFile(path, "utf8");
}

describe("Phase 9B provider and edge hardening", () => {
  it("uses only the public Turnstile site-key boundary and passes captchaToken to Supabase Auth", async () => {
    const authForm = await read(authFormPath);
    const turnstile = await read(turnstilePath);
    const source = `${authForm}\n${turnstile}`;

    expect(authForm).toContain("NEXT_PUBLIC_TURNSTILE_SITE_KEY");
    expect(authForm).toContain("captchaToken");
    expect(source).not.toMatch(/NEXT_PUBLIC_[A-Z0-9_]*(?:TURNSTILE)?(?:SECRET|PRIVATE|TOKEN_SECRET)/i);
  });

  it("never persists CAPTCHA tokens in browser storage, cookies, or URL state", async () => {
    const source = `${await read(authFormPath)}\n${await read(turnstilePath)}`;

    expect(source).not.toMatch(/\blocalStorage\b|\bsessionStorage\b|document\.cookie/i);
    expect(source).not.toMatch(/URLSearchParams|location\.(?:search|hash)|history\.(?:pushState|replaceState)/i);
  });

  it("adds no Turnstile or custom auth-rate-limit package", async () => {
    const packageJson = JSON.parse(await read(packagePath)) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const packageNames = [
      ...Object.keys(packageJson.dependencies ?? {}),
      ...Object.keys(packageJson.devDependencies ?? {})
    ].join("\n");

    expect(packageNames).not.toMatch(/turnstile|rate[-_]?limit|ratelimit|upstash|redis/i);
  });

  it("keeps hosted runtime authority outside the Phase 9B client boundary", async () => {
    const source = `${await read(authFormPath)}\n${await read(turnstilePath)}`;
    expect(source).not.toMatch(/HOSTED_(?:REPOSITORY|PASSIVE|ACTIVE)/i);
    expect(source).not.toMatch(/phase_9c_function_acl_hardening/i);
  });

  it("records provider activation truth and rollback ordering", async () => {
    const providerState = await read(providerStatePath);

    expect(providerState).toMatch(/leaked-password protection:\s*NOT ENABLED/i);
    expect(providerState).toMatch(/current organization plan is Free/i);
    expect(providerState).toMatch(/production Turnstile enforcement:\s*PENDING/i);
    expect(providerState).toMatch(/Vercel WAF custom rule state:\s*NOT CLAIMED/i);
    expect(providerState).toMatch(/disable Supabase CAPTCHA enforcement first/i);
    expect(providerState).toMatch(/remove the public site-key environment variable/i);
  });
});
