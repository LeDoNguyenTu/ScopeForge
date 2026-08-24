import { posix } from "node:path";

import type { ScannerDiagnostic } from "../scanner-core/coordinator/types";
import { compareText } from "../scanner-core/determinism/compare-text";
import { readInventoryEntry } from "../scanner-core/filesystem/read-inventory-entry";
import type { RepositoryInventory } from "../scanner-core/inventory/types";
import { parsePackageLock } from "./lockfiles/package-lock";
import { parsePnpmLock } from "./lockfiles/pnpm-lock";
import { parseYarnLock } from "./lockfiles/yarn-lock";
import { parsePackageJson } from "./manifests/package-json";
import type { DependencyInventoryResult, DependencyParseResult, NpmDependencyComponent } from "./types";

const LOCKFILE_PRIORITY = ["npm-shrinkwrap.json", "package-lock.json", "pnpm-lock.yaml", "yarn.lock"] as const;
const SUPPORTED_FILES = new Set<string>([...LOCKFILE_PRIORITY, "package.json"]);

interface DirectoryFiles {
  manifest?: string;
  lockfiles: Map<string, string>;
}

function parserFor(file: string): (input: { file: string; content: string }) => DependencyParseResult {
  switch (posix.basename(file)) {
    case "npm-shrinkwrap.json":
    case "package-lock.json":
      return parsePackageLock;
    case "pnpm-lock.yaml":
      return parsePnpmLock;
    case "yarn.lock":
      return parseYarnLock;
    case "package.json":
      return parsePackageJson;
    default:
      return () => ({ components: [], errors: [] });
  }
}

function compareComponents(left: NpmDependencyComponent, right: NpmDependencyComponent): number {
  return (
    compareText(left.sourceFile, right.sourceFile) ||
    compareText(left.name, right.name) ||
    compareText(left.version, right.version) ||
    left.sourceLine - right.sourceLine
  );
}

function compareErrors(left: ScannerDiagnostic, right: ScannerDiagnostic): number {
  return compareText(left.file ?? "", right.file ?? "") || compareText(left.code, right.code);
}

export async function collectNpmDependencies(inventory: RepositoryInventory): Promise<DependencyInventoryResult> {
  const byDirectory = new Map<string, DirectoryFiles>();

  for (const entry of inventory.entries) {
    const name = posix.basename(entry.path);
    if (!SUPPORTED_FILES.has(name)) continue;
    const directory = posix.dirname(entry.path);
    const files = byDirectory.get(directory) ?? { lockfiles: new Map<string, string>() };
    if (name === "package.json") files.manifest = entry.path;
    else files.lockfiles.set(name, entry.path);
    byDirectory.set(directory, files);
  }

  const components: NpmDependencyComponent[] = [];
  const errors: ScannerDiagnostic[] = [];

  for (const directory of [...byDirectory.keys()].sort(compareText)) {
    const files = byDirectory.get(directory) as DirectoryFiles;
    let selected: string | undefined;
    for (const name of LOCKFILE_PRIORITY) {
      const candidate = files.lockfiles.get(name);
      if (candidate) {
        selected = candidate;
        break;
      }
    }
    selected ??= files.manifest;
    if (!selected) continue;

    let content: string;
    try {
      content = await readInventoryEntry(inventory, selected);
    } catch {
      errors.push({
        code: "dependency_read_failed",
        file: selected,
        message: `Dependency source could not be read safely: ${selected}`
      });
      continue;
    }

    const parsed = parserFor(selected)({ file: selected, content });
    components.push(...parsed.components);
    errors.push(...parsed.errors);
  }

  return {
    components: components.sort(compareComponents),
    errors: errors.sort(compareErrors)
  };
}
