import { constants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

import { defaultInventoryBudgets, type RepositoryInventory } from "../inventory/types";

export type InventoryReadErrorCode =
  | "invalid_path"
  | "not_in_inventory"
  | "symlink"
  | "outside_root"
  | "not_regular_file"
  | "file_too_large"
  | "changed_during_read"
  | "unreadable";

export class InventoryReadError extends Error {
  readonly code: InventoryReadErrorCode;

  constructor(code: InventoryReadErrorCode, message: string) {
    super(message);
    this.name = "InventoryReadError";
    this.code = code;
  }
}

export interface ReadInventoryEntryOptions {
  maxFileBytes?: number;
}

function isContained(root: string, candidate: string): boolean {
  const pathFromRoot = relative(root, candidate);
  return (
    pathFromRoot === "" ||
    (!isAbsolute(pathFromRoot) && pathFromRoot !== ".." && !pathFromRoot.startsWith(`..${sep}`))
  );
}

function validateRepositoryPath(repositoryPath: string): void {
  if (
    !repositoryPath ||
    isAbsolute(repositoryPath) ||
    repositoryPath.includes("\\") ||
    repositoryPath.split("/").some((segment) => segment === ".." || segment === "")
  ) {
    throw new InventoryReadError("invalid_path", "Inventory entry path must be a canonical repository-relative path.");
  }
}

function nodeErrorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code)
    : undefined;
}

export async function readInventoryEntry(
  inventory: RepositoryInventory,
  repositoryPath: string,
  options: ReadInventoryEntryOptions = {}
): Promise<string> {
  validateRepositoryPath(repositoryPath);

  const entry = inventory.entries.find((candidate) => candidate.path === repositoryPath);
  if (!entry) {
    throw new InventoryReadError("not_in_inventory", `Path is not present in the bounded inventory: ${repositoryPath}`);
  }

  const root = resolve(inventory.root);
  const candidate = resolve(root, ...repositoryPath.split("/"));
  if (!isContained(root, candidate)) {
    throw new InventoryReadError("outside_root", "Inventory entry resolved outside the scan root.");
  }

  let pathStat;
  try {
    pathStat = await lstat(candidate);
  } catch {
    throw new InventoryReadError("unreadable", `Inventory entry is no longer readable: ${repositoryPath}`);
  }

  if (pathStat.isSymbolicLink()) {
    throw new InventoryReadError("symlink", `Inventory entry became a symlink: ${repositoryPath}`);
  }
  if (!pathStat.isFile()) {
    throw new InventoryReadError("not_regular_file", `Inventory entry is not a regular file: ${repositoryPath}`);
  }

  let realRoot: string;
  let realCandidate: string;
  try {
    [realRoot, realCandidate] = await Promise.all([realpath(root), realpath(candidate)]);
  } catch {
    throw new InventoryReadError("unreadable", `Inventory entry could not be resolved safely: ${repositoryPath}`);
  }

  if (!isContained(realRoot, realCandidate)) {
    throw new InventoryReadError("outside_root", `Inventory entry resolves outside the scan root: ${repositoryPath}`);
  }

  const maxFileBytes = options.maxFileBytes ?? defaultInventoryBudgets.maxFileBytes;
  if (!Number.isSafeInteger(maxFileBytes) || maxFileBytes <= 0) {
    throw new InventoryReadError("file_too_large", "The read byte limit must be a positive safe integer.");
  }
  if (pathStat.size > maxFileBytes) {
    throw new InventoryReadError("file_too_large", `Inventory entry exceeds the read byte limit: ${repositoryPath}`);
  }

  const noFollow = (constants as typeof constants & { O_NOFOLLOW?: number }).O_NOFOLLOW ?? 0;
  let handle;
  try {
    handle = await open(candidate, constants.O_RDONLY | noFollow);
  } catch (error) {
    if (nodeErrorCode(error) === "ELOOP") {
      throw new InventoryReadError("symlink", `Inventory entry became a symlink: ${repositoryPath}`);
    }
    throw new InventoryReadError("unreadable", `Inventory entry could not be opened safely: ${repositoryPath}`);
  }

  try {
    const openedStat = await handle.stat();
    if (!openedStat.isFile()) {
      throw new InventoryReadError("not_regular_file", `Opened inventory entry is not a regular file: ${repositoryPath}`);
    }
    if (openedStat.size > maxFileBytes) {
      throw new InventoryReadError("file_too_large", `Inventory entry exceeds the read byte limit: ${repositoryPath}`);
    }
    if (openedStat.dev !== pathStat.dev || openedStat.ino !== pathStat.ino) {
      throw new InventoryReadError("changed_during_read", `Inventory entry changed while it was being opened: ${repositoryPath}`);
    }

    return await handle.readFile({ encoding: "utf8" });
  } finally {
    await handle.close();
  }
}
