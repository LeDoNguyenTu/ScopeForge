import { lstat } from "node:fs/promises";
import { resolve } from "node:path";
import { runScan } from "../scanner-core/coordinator/run-scan";
import { buildRepositoryInventory } from "../scanner-core/inventory/build-inventory";
import { serializeHostedScanResult } from "../scanner-output/hosted/serialize";
import type { HostedPhase3EnvelopeV1 } from "../scanner-output/hosted/types";
import {
  HOSTED_PHASE3_SCANNER_DESCRIPTORS,
  HOSTED_PHASE3_TOOL_VERSION,
  createHostedPhase3Scanners,
} from "./profile";

export class HostedScannerRunnerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HostedScannerRunnerError";
  }
}

async function assertRepositoryRoot(root: string): Promise<string> {
  const absolute = resolve(root);
  let metadata;
  try {
    metadata = await lstat(absolute);
  } catch {
    throw new HostedScannerRunnerError("Hosted scanner source root is unavailable.");
  }
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
    throw new HostedScannerRunnerError("Hosted scanner source root must be a real directory.");
  }
  return absolute;
}

export async function runHostedRepositoryScan(input: {
  root: string;
  canonicalRepositoryUrl: string;
}): Promise<HostedPhase3EnvelopeV1> {
  const root = await assertRepositoryRoot(input.root);
  const inventory = await buildRepositoryInventory(root);
  const result = await runScan({
    root,
    inventory,
    scanners: createHostedPhase3Scanners(),
  });

  if (result.errors.length > 0) {
    throw new HostedScannerRunnerError("Hosted scan produced scanner diagnostics and cannot be published.");
  }

  const actualDescriptors = [...result.scan.scanners].sort();
  if (
    actualDescriptors.length !== HOSTED_PHASE3_SCANNER_DESCRIPTORS.length
    || actualDescriptors.some((descriptor, index) => descriptor !== HOSTED_PHASE3_SCANNER_DESCRIPTORS[index])
  ) {
    throw new HostedScannerRunnerError("Hosted scanner profile did not match the fixed reviewed scanner set.");
  }

  const serialized = serializeHostedScanResult(result, {
    toolVersion: HOSTED_PHASE3_TOOL_VERSION,
    repositoryUrl: input.canonicalRepositoryUrl,
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new HostedScannerRunnerError("Hosted scanner result serialization failed.");
  }
  return parsed as HostedPhase3EnvelopeV1;
}