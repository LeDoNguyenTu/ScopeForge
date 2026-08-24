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

function cleanKey(value: string): string {
  let key = value.trim();
  if (key.endsWith(":")) key = key.slice(0, -1).trim();
  if ((key.startsWith("'") && key.endsWith("'")) || (key.startsWith('"') && key.endsWith('"'))) {
    key = key.slice(1, -1);
  }
  const peerSuffix = key.indexOf("(");
  if (peerSuffix >= 0) key = key.slice(0, peerSuffix);
  if (key.startsWith("/")) key = key.slice(1);
  return key;
}

function splitPnpmIdentity(raw: string): { name: string; version: string } | null {
  const key = cleanKey(raw);
  if (!key) return null;

  if (key.startsWith("@")) {
    const scopeSlash = key.indexOf("/");
    if (scopeSlash < 2) return null;
    const atDelimiter = key.indexOf("@", scopeSlash + 1);
    const slashDelimiter = key.indexOf("/", scopeSlash + 1);
    const delimiter = atDelimiter >= 0 ? atDelimiter : slashDelimiter;
    if (delimiter < 0) return null;
    const name = key.slice(0, delimiter);
    const version = key.slice(delimiter + 1);
    return name && isExactNpmVersion(version) ? { name, version } : null;
  }

  const atDelimiter = key.lastIndexOf("@");
  const slashDelimiter = key.lastIndexOf("/");
  const delimiter = atDelimiter > 0 ? atDelimiter : slashDelimiter;
  if (delimiter <= 0) return null;
  const name = key.slice(0, delimiter);
  const version = key.slice(delimiter + 1);
  return name && isExactNpmVersion(version) ? { name, version } : null;
}

export function parsePnpmLock({ file, content }: ParseDependencyInput): DependencyParseResult {
  const lines = content.split(/\r?\n/);
  if (lines.some((line) => Buffer.byteLength(line, "utf8") > MAX_LOCKFILE_LINE_BYTES)) {
    return { components: [], errors: [parseError("invalid_lockfile", file, "pnpm lockfile contains an oversized line.")] };
  }

  const components: NpmDependencyComponent[] = [];
  let inPackages = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] as string;
    if (/^packages:\s*$/.test(line)) {
      inPackages = true;
      continue;
    }
    if (inPackages && /^\S/.test(line) && line.trim() !== "") {
      inPackages = false;
    }
    if (!inPackages) continue;

    const match = /^ {2}([^ ].*):\s*$/.exec(line);
    if (!match) continue;
    const identity = splitPnpmIdentity(match[1] as string);
    if (!identity) continue;

    components.push({
      ecosystem: "npm",
      name: identity.name,
      version: identity.version,
      purl: createNpmPurl(identity.name, identity.version),
      sourceFile: file,
      sourceKind: "lockfile",
      certainty: "resolved",
      direct: false,
      dependencyGroup: "transitive",
      sourceLine: index + 1,
      queryable: true
    });
    if (components.length > MAX_PARSED_COMPONENTS) {
      return {
        components: [],
        errors: [parseError("dependency_budget_exceeded", file, "pnpm lockfile exceeds the dependency component budget.")]
      };
    }
  }

  return { components: dedupeNpmComponents(components), errors: [] };
}
