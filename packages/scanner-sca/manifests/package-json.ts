import {
  createNpmPurl,
  dedupeNpmComponents,
  isExactNpmVersion,
  isPlainObject,
  lineForNeedle,
  parseError,
  type DependencyParseResult,
  type NpmDependencyComponent,
  type NpmDependencyGroup,
  type ParseDependencyInput
} from "../types";

const GROUPS: Array<[string, NpmDependencyGroup]> = [
  ["dependencies", "runtime"],
  ["optionalDependencies", "optional"],
  ["devDependencies", "development"],
  ["peerDependencies", "peer"]
];

function packageOnlyPurl(name: string): string {
  if (name.startsWith("@")) {
    const slash = name.indexOf("/");
    if (slash > 1) {
      return `pkg:npm/${encodeURIComponent(name.slice(0, slash))}/${encodeURIComponent(name.slice(slash + 1))}`;
    }
  }
  return `pkg:npm/${encodeURIComponent(name)}`;
}

export function parsePackageJson({ file, content }: ParseDependencyInput): DependencyParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return { components: [], errors: [parseError("invalid_manifest", file, "package.json is not valid JSON.")] };
  }
  if (!isPlainObject(parsed)) {
    return { components: [], errors: [parseError("invalid_manifest", file, "package.json root must be an object.")] };
  }

  const chosen = new Map<string, { version: string; group: NpmDependencyGroup }>();
  for (const [property, group] of GROUPS) {
    const value = parsed[property];
    if (value === undefined) continue;
    if (!isPlainObject(value)) {
      return {
        components: [],
        errors: [parseError("invalid_manifest", file, `package.json ${property} must be an object.`)]
      };
    }
    for (const name of Object.keys(value).sort()) {
      const version = value[name];
      if (typeof version !== "string" || version.trim() === "") {
        return {
          components: [],
          errors: [parseError("invalid_manifest", file, `package.json ${property}.${name} must be a non-empty string.`)]
        };
      }
      if (!chosen.has(name)) chosen.set(name, { version: version.trim(), group });
    }
  }

  const components: NpmDependencyComponent[] = [];
  for (const [name, item] of chosen) {
    const exact = isExactNpmVersion(item.version);
    components.push({
      ecosystem: "npm",
      name,
      version: item.version,
      purl: exact ? createNpmPurl(name, item.version) : packageOnlyPurl(name),
      sourceFile: file,
      sourceKind: "manifest",
      certainty: exact ? "manifest_exact" : "manifest_range",
      direct: true,
      dependencyGroup: item.group,
      sourceLine: lineForNeedle(content, JSON.stringify(name)),
      queryable: exact
    });
  }

  return { components: dedupeNpmComponents(components), errors: [] };
}
