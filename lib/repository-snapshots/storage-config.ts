import type { R2SigningCredentials } from "./r2-signature-v4";

const ACCOUNT_ID_PATTERN = /^[a-f0-9]{32}$/;
const BUCKET_PATTERN = /^[a-z0-9](?:[a-z0-9.-]{1,61}[a-z0-9])?$/;

export interface RepositorySnapshotStorageConfig extends R2SigningCredentials {}

function required(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key]?.trim();
  if (!value) throw new Error(`Missing server-only repository snapshot storage setting: ${key}.`);
  return value;
}

export function loadRepositorySnapshotStorageConfig(
  env: NodeJS.ProcessEnv = process.env,
): RepositorySnapshotStorageConfig {
  const accountId = required(env, "R2_ACCOUNT_ID");
  const accessKeyId = required(env, "R2_ACCESS_KEY_ID");
  const secretAccessKey = required(env, "R2_SECRET_ACCESS_KEY");
  const bucket = required(env, "R2_BUCKET_NAME");

  if (!ACCOUNT_ID_PATTERN.test(accountId)) {
    throw new Error("R2_ACCOUNT_ID is invalid.");
  }
  if (accessKeyId.length < 8 || accessKeyId.length > 128) {
    throw new Error("R2_ACCESS_KEY_ID is invalid.");
  }
  if (secretAccessKey.length < 16 || secretAccessKey.length > 256) {
    throw new Error("R2_SECRET_ACCESS_KEY is invalid.");
  }
  if (!BUCKET_PATTERN.test(bucket) || bucket.includes("..")) {
    throw new Error("R2_BUCKET_NAME is invalid.");
  }

  return Object.freeze({ accountId, accessKeyId, secretAccessKey, bucket });
}
