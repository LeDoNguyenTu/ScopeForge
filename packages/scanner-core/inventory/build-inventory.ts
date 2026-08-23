import { lstat, readFile, readdir } from "node:fs/promises";
import { basename, extname, join, relative, resolve } from "node:path";

import { compileIgnorePatterns, type IgnoreMatcher } from "./patterns";
import {
  defaultInventoryBudgets,
  type InventoryBudgets,
  type InventoryEntry,
  type InventoryEntryKind,
  type InventorySkipCounts,
  type InventorySkipReason,
  type RepositoryInventory
} from "./types";

const DEFAULT_EXCLUDED_SEGMENTS = new Set([
  ".git",
  "node_modules",
  ".next",
  "dist",
  "build",
  "coverage",
  "vendor",
  ".venv"
]);

const MAX_IGNORE_FILE_BYTES = 256 * 1024;

function createSkipCounts(): InventorySkipCounts {
  return {
    default_exclude: 0,
    gitignore: 0,
    scopeforgeignore: 0,
    symlink: 0,
    file_too_large: 0,
    file_limit: 0,
    total_bytes_limit: 0,
    unreadable: 0
  };
}

function normalizeRelativePath(value: string): string {
  return value.replace(/\\/g, "/");
}

function containsDefaultExcludedSegment(repositoryPath: string): boolean {
  return normalizeRelativePath(repositoryPath)
    .split("/")
    .some((segment) => DEFAULT_EXCLUDED_SEGMENTS.has(segment));
}

async function loadIgnoreMatcher(root: string, fileName: string): Promise<IgnoreMatcher> {
  try {
    const stat = await lstat(join(root, fileName));
    if (!stat.isFile() || stat.size > MAX_IGNORE_FILE_BYTES) return () => false;
    return compileIgnorePatterns(await readFile(join(root, fileName), "utf8"));
  } catch {
    return () => false;
  }
}

function classifyEntry(repositoryPath: string): Pick<InventoryEntry, "kind" | "language"> {
  const name = basename(repositoryPath);
  const extension = extname(name).toLowerCase();

  const languageByExtension: Record<string, string> = {
    ".js": "JavaScript",
    ".jsx": "JavaScript",
    ".mjs": "JavaScript",
    ".cjs": "JavaScript",
    ".ts": "TypeScript",
    ".tsx": "TypeScript",
    ".mts": "TypeScript",
    ".cts": "TypeScript"
  };

  if (languageByExtension[extension]) {
    return { kind: "source", language: languageByExtension[extension] };
  }

  if (["package.json", "pyproject.toml", "go.mod", "Cargo.toml"].includes(name)) {
    return { kind: "manifest" };
  }

  if (
    ["package-lock.json", "npm-shrinkwrap.json", "pnpm-lock.yaml", "yarn.lock"].includes(name)
  ) {
    return { kind: "lockfile" };
  }

  if (
    name === "Dockerfile" ||
    name.startsWith("Dockerfile.") ||
    extension === ".tf" ||
    repositoryPath.startsWith(".github/workflows/") ||
    extension === ".yaml" ||
    extension === ".yml"
  ) {
    return { kind: "infrastructure" };
  }

  if ([".json", ".toml", ".ini", ".conf"].includes(extension)) {
    return { kind: "config" };
  }

  return { kind: "other" };
}

function incrementSkip(skippedByReason: InventorySkipCounts, reason: InventorySkipReason): void {
  skippedByReason[reason] += 1;
}

export async function buildRepositoryInventory(
  root: string,
  options: Partial<InventoryBudgets> = {}
): Promise<RepositoryInventory> {
  const scanRoot = resolve(root);
  const budgets: InventoryBudgets = { ...defaultInventoryBudgets, ...options };
  const skippedByReason = createSkipCounts();
  const entries: InventoryEntry[] = [];
  const languages: Record<string, number> = {};
  const manifests: string[] = [];
  const infrastructure: string[] = [];
  let totalBytes = 0;

  const scopeforgeIgnore = await loadIgnoreMatcher(scanRoot, ".scopeforgeignore");
  const gitIgnore = await loadIgnoreMatcher(scanRoot, ".gitignore");

  async function walk(absolutePath: string): Promise<void> {
    let stat;
    try {
      stat = await lstat(absolutePath);
    } catch {
      incrementSkip(skippedByReason, "unreadable");
      return;
    }

    const repositoryPath = normalizeRelativePath(relative(scanRoot, absolutePath));
    const isRoot = repositoryPath === "";

    if (!isRoot && stat.isSymbolicLink()) {
      incrementSkip(skippedByReason, "symlink");
      return;
    }

    if (!isRoot && containsDefaultExcludedSegment(repositoryPath)) {
      incrementSkip(skippedByReason, "default_exclude");
      return;
    }

    if (!isRoot && scopeforgeIgnore(repositoryPath, stat.isDirectory())) {
      incrementSkip(skippedByReason, "scopeforgeignore");
      return;
    }

    if (!isRoot && gitIgnore(repositoryPath, stat.isDirectory())) {
      incrementSkip(skippedByReason, "gitignore");
      return;
    }

    if (stat.isDirectory()) {
      let children;
      try {
        children = await readdir(absolutePath, { withFileTypes: true });
      } catch {
        incrementSkip(skippedByReason, "unreadable");
        return;
      }

      children.sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));
      for (const child of children) {
        if (entries.length >= budgets.maxFiles) {
          incrementSkip(skippedByReason, "file_limit");
          break;
        }
        await walk(join(absolutePath, child.name));
      }
      return;
    }

    if (!stat.isFile()) return;

    if (entries.length >= budgets.maxFiles) {
      incrementSkip(skippedByReason, "file_limit");
      return;
    }

    if (stat.size > budgets.maxFileBytes) {
      incrementSkip(skippedByReason, "file_too_large");
      return;
    }

    if (totalBytes + stat.size > budgets.maxTotalBytes) {
      incrementSkip(skippedByReason, "total_bytes_limit");
      return;
    }

    const classification = classifyEntry(repositoryPath);
    const entry: InventoryEntry = {
      path: repositoryPath,
      size: stat.size,
      ...classification
    };

    entries.push(entry);
    totalBytes += stat.size;

    if (entry.language) languages[entry.language] = (languages[entry.language] ?? 0) + 1;
    if (entry.kind === "manifest" || entry.kind === "lockfile") manifests.push(entry.path);
    if (entry.kind === "infrastructure") infrastructure.push(entry.path);
  }

  await walk(scanRoot);

  const filesSkipped = Object.values(skippedByReason).reduce((total, count) => total + count, 0);

  return {
    root: scanRoot,
    entries,
    summary: {
      filesAnalyzed: entries.length,
      filesSkipped,
      totalBytes,
      languages,
      manifests,
      infrastructure,
      skippedByReason
    }
  };
}
