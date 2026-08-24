import type { ScannerDiagnostic } from "../scanner-core/coordinator/types";

export type DependencyVersionCertainty = "resolved" | "manifest_exact" | "manifest_range";
export type DependencySourceKind = "lockfile" | "manifest";
export type NpmDependencyGroup = "runtime" | "development" | "optional" | "peer" | "transitive";

export interface NpmDependencyComponent {
  ecosystem: "npm";
  name: string;
  version: string;
  purl: string;
  sourceFile: string;
  sourceKind: DependencySourceKind;
  certainty: DependencyVersionCertainty;
  direct: boolean;
  dependencyGroup: NpmDependencyGroup;
  sourceLine: number;
  queryable: boolean;
}

export interface DependencyParseResult {
  components: NpmDependencyComponent[];
  errors: ScannerDiagnostic[];
}

export interface DependencyInventoryResult extends DependencyParseResult {}

export interface ParseDependencyInput {
  file: string;
  content: string;
}

export const MAX_LOCKFILE_LINE_BYTES = 64 * 1024;
export const MAX_PARSED_COMPONENTS = 25_000;

export function createNpmPurl(name: string, version: string): string {
  if (name.startsWith("@")) {
    const slash = name.indexOf("/");
    if (slash > 1) {
      const namespace = encodeURIComponent(name.slice(0, slash));
      const packageName = encodeURIComponent(name.slice(slash + 1));
      return `pkg:npm/${namespace}/${packageName}@${encodeURIComponent(version)}`;
    }
  }
  return `pkg:npm/${encodeURIComponent(name)}@${encodeURIComponent(version)}`;
}

export function lineForNeedle(content: string, needle: string): number {
  const index = content.indexOf(needle);
  if (index < 0) return 1;
  let line = 1;
  for (let offset = 0; offset < index; offset += 1) {
    if (content.charCodeAt(offset) === 10) line += 1;
  }
  return line;
}

export function compareNpmComponents(left: NpmDependencyComponent, right: NpmDependencyComponent): number {
  return (
    left.name.localeCompare(right.name) ||
    left.version.localeCompare(right.version) ||
    left.sourceFile.localeCompare(right.sourceFile) ||
    left.sourceLine - right.sourceLine ||
    Number(right.direct) - Number(left.direct)
  );
}

function groupRank(group: NpmDependencyGroup): number {
  switch (group) {
    case "runtime": return 0;
    case "optional": return 1;
    case "development": return 2;
    case "peer": return 3;
    case "transitive": return 4;
  }
}

export function dedupeNpmComponents(components: readonly NpmDependencyComponent[]): NpmDependencyComponent[] {
  const byIdentity = new Map<string, NpmDependencyComponent>();
  for (const component of components) {
    const key = `${component.name}\u0000${component.version}\u0000${component.sourceFile}`;
    const previous = byIdentity.get(key);
    if (!previous) {
      byIdentity.set(key, component);
      continue;
    }
    if (
      (!previous.direct && component.direct) ||
      (previous.direct === component.direct && groupRank(component.dependencyGroup) < groupRank(previous.dependencyGroup)) ||
      (previous.direct === component.direct && component.dependencyGroup === previous.dependencyGroup && component.sourceLine < previous.sourceLine)
    ) {
      byIdentity.set(key, component);
    }
  }
  return [...byIdentity.values()].sort(compareNpmComponents);
}

export function parseError(code: string, file: string, message: string): ScannerDiagnostic {
  return { code, file, message };
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isExactNpmVersion(value: string): boolean {
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(value.trim());
}
