import {
  MAX_LOCKFILE_LINE_BYTES,
  MAX_PARSED_COMPONENTS,
  createNpmPurl,
  dedupeNpmComponents,
  isExactNpmVersion,
  parseError,
  type DependencyParseResult,
  type NpmDependencyComponent,
  type ParseDependencyInput
} from "../types";

function firstSelector(value: string): string {
  let selector = value.trim();
  if (selector.endsWith(":")) selector = selector.slice(0, -1).trim();
  const comma = selector.indexOf(",");
  if (comma >= 0) selector = selector.slice(0, comma).trim();
  if ((selector.startsWith('"') && selector.endsWith('"')) || (selector.startsWith("'") && selector.endsWith("'"))) {
    selector = selector.slice(1, -1);
  }
  return selector;
}

function selectorPackageName(value: string): string | null {
  const selector = firstSelector(value);
  if (selector.startsWith("@")) {
    const slash = selector.indexOf("/");
    if (slash < 2) return null;
    const delimiter = selector.indexOf("@", slash + 1);
    return delimiter > slash + 1 ? selector.slice(0, delimiter) : null;
  }
  const delimiter = selector.indexOf("@");
  return delimiter > 0 ? selector.slice(0, delimiter) : null;
}

function versionFromLine(line: string): string | null {
  const classic = /^\s+version\s+["']([^"']+)["']\s*$/.exec(line);
  if (classic) return (classic[1] as string).trim();
  const berry = /^\s+version:\s*["']?([^"'\s]+)["']?\s*$/.exec(line);
  return berry ? (berry[1] as string).trim() : null;
}

export function parseYarnLock({ file, content }: ParseDependencyInput): DependencyParseResult {
  const lines = content.split(/\r?\n/);
  if (lines.some((line) => Buffer.byteLength(line, "utf8") > MAX_LOCKFILE_LINE_BYTES)) {
    return { components: [], errors: [parseError("invalid_lockfile", file, "Yarn lockfile contains an oversized line.")] };
  }

  const components: NpmDependencyComponent[] = [];
  let pendingName: string | null = null;
  let pendingLine = 1;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] as string;
    if (/^\S.*:\s*$/.test(line) && !line.startsWith("#")) {
      pendingName = selectorPackageName(line);
      pendingLine = index + 1;
      continue;
    }
    if (!pendingName) continue;

    const version = versionFromLine(line);
    if (!version) continue;
    if (!isExactNpmVersion(version)) {
      pendingName = null;
      continue;
    }
    components.push({
      ecosystem: "npm",
      name: pendingName,
      version,
      purl: createNpmPurl(pendingName, version),
      sourceFile: file,
      sourceKind: "lockfile",
      certainty: "resolved",
      direct: false,
      dependencyGroup: "transitive",
      sourceLine: pendingLine,
      queryable: true
    });
    pendingName = null;

    if (components.length > MAX_PARSED_COMPONENTS) {
      return {
        components: [],
        errors: [parseError("dependency_budget_exceeded", file, "Yarn lockfile exceeds the dependency component budget.")]
      };
    }
  }

  return { components: dedupeNpmComponents(components), errors: [] };
}
