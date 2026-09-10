import { describe, expect, it } from "vitest";
import { getGitHubAppConfig } from "@/lib/github-app/config";

const validEnv = {
  GITHUB_APP_ID: "123456",
  GITHUB_APP_CLIENT_ID: "Iv1.0123456789abcdef",
  GITHUB_APP_CLIENT_SECRET: "client-secret-value-0123456789",
  GITHUB_APP_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----",
  GITHUB_APP_SLUG: "scopeforge-dev",
  GITHUB_APP_STATE_SECRET: "0123456789abcdef0123456789abcdef",
};

describe("GitHub App server configuration", () => {
  it("loads only the six server-only settings", () => {
    expect(getGitHubAppConfig(validEnv)).toEqual(validEnv);
  });

  it.each(Object.keys(validEnv))("rejects missing %s", (key) => {
    const env = { ...validEnv } as Record<string, string | undefined>;
    delete env[key];
    expect(() => getGitHubAppConfig(env)).toThrow(`Missing server-only GitHub App setting: ${key}.`);
  });

  it("does not accept NEXT_PUBLIC secret fallbacks", () => {
    expect(() => getGitHubAppConfig({
      ...validEnv,
      GITHUB_APP_CLIENT_SECRET: undefined,
      NEXT_PUBLIC_GITHUB_APP_CLIENT_SECRET: validEnv.GITHUB_APP_CLIENT_SECRET,
    })).toThrow("Missing server-only GitHub App setting: GITHUB_APP_CLIENT_SECRET.");
  });

  it("rejects malformed app ids, slugs, and short state secrets", () => {
    expect(() => getGitHubAppConfig({ ...validEnv, GITHUB_APP_ID: "abc" })).toThrow("GITHUB_APP_ID is invalid.");
    expect(() => getGitHubAppConfig({ ...validEnv, GITHUB_APP_SLUG: "Bad Slug" })).toThrow("GITHUB_APP_SLUG is invalid.");
    expect(() => getGitHubAppConfig({ ...validEnv, GITHUB_APP_STATE_SECRET: "too-short" })).toThrow("GITHUB_APP_STATE_SECRET is invalid.");
  });
});
