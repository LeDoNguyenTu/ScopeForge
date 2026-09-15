import type { GitHubAppConfig } from "./types";

const APP_ID_PATTERN = /^[1-9][0-9]{0,19}$/;
const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?$/;

export type GitHubAppEnvironment = Readonly<Record<string, string | undefined>>;

function required(env: GitHubAppEnvironment, key: string): string {
  const value = env[key]?.trim();
  if (!value) throw new Error(`Missing server-only GitHub App setting: ${key}.`);
  return value;
}

export function getGitHubAppConfig(
  env: GitHubAppEnvironment = process.env as GitHubAppEnvironment,
): GitHubAppConfig {
  const appId = required(env, "GITHUB_APP_ID");
  const clientId = required(env, "GITHUB_APP_CLIENT_ID");
  const clientSecret = required(env, "GITHUB_APP_CLIENT_SECRET");
  const privateKey = required(env, "GITHUB_APP_PRIVATE_KEY").replace(/\\n/g, "\n");
  const slug = required(env, "GITHUB_APP_SLUG");
  const stateSecret = required(env, "GITHUB_APP_STATE_SECRET");
  const webhookSecret = required(env, "GITHUB_APP_WEBHOOK_SECRET");

  if (!APP_ID_PATTERN.test(appId)) throw new Error("GITHUB_APP_ID is invalid.");
  if (clientId.length < 8 || clientId.length > 128) throw new Error("GITHUB_APP_CLIENT_ID is invalid.");
  if (clientSecret.length < 16 || clientSecret.length > 256) throw new Error("GITHUB_APP_CLIENT_SECRET is invalid.");
  if (privateKey.length < 32 || privateKey.length > 16384) throw new Error("GITHUB_APP_PRIVATE_KEY is invalid.");
  if (!SLUG_PATTERN.test(slug)) throw new Error("GITHUB_APP_SLUG is invalid.");
  if (stateSecret.length < 32 || stateSecret.length > 512) throw new Error("GITHUB_APP_STATE_SECRET is invalid.");
  if (webhookSecret.length < 32 || webhookSecret.length > 512) throw new Error("GITHUB_APP_WEBHOOK_SECRET is invalid.");

  return Object.freeze({
    appId,
    clientId,
    clientSecret,
    privateKey,
    slug,
    stateSecret,
    webhookSecret,
  });
}
