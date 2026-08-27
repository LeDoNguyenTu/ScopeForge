import { readFile } from "node:fs/promises";
import { runHostedRepositoryScan } from "./run";

const SOURCE_ROOT = "/workspace";
const TASK_METADATA_PATH = "/scopeforge/task.json";
const MAX_TASK_METADATA_BYTES = 2048;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readCanonicalRepositoryUrl(): Promise<string> {
  const bytes = await readFile(TASK_METADATA_PATH);
  if (bytes.length < 2 || bytes.length > MAX_TASK_METADATA_BYTES) {
    throw new Error("Hosted scanner task metadata is outside the fixed boundary.");
  }
  let value: unknown;
  try {
    value = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new Error("Hosted scanner task metadata is invalid.");
  }
  if (!isRecord(value) || Object.keys(value).length !== 1 || typeof value.canonicalRepositoryUrl !== "string") {
    throw new Error("Hosted scanner task metadata is invalid.");
  }
  return value.canonicalRepositoryUrl;
}

async function main(): Promise<void> {
  const canonicalRepositoryUrl = await readCanonicalRepositoryUrl();
  const result = await runHostedRepositoryScan({
    root: SOURCE_ROOT,
    canonicalRepositoryUrl,
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

void main().catch(() => {
  process.exitCode = 1;
});