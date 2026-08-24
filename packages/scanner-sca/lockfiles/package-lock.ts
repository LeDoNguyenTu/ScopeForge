import {
  MAX_PARSED_COMPONENTS,
  createNpmPurl,
  dedupeNpmComponents,
  isPlainObject,
  lineForNeedle,
  parseError,
  type DependencyParseResult,
  type NpmDependencyComponent,
  type NpmDependencyGroup,
  type ParseDependencyInput
} from "../types";

function rootGroup(rootPackage: Record<string, unknown>, name: string): NpmDependencyGroup {
  const groups: Array<[string, NpmDependencyGroup]> = [
    ["dependencies", "runtime"],
    ["optionalDependencies", "optional"],
    ["devDependencies", "development"],
    ["peerDependencies", "peer"]
  ];
  for (const [property, group] of groups) {
    const value = rootPackage[property];
    if (isPlainObject(value) && Object.prototype.hasOwnProperty.call(value, name)) return group;
  }
  return "runtime";
}

function nameFromPackageLocation(location: string): string | null {
  const marker = "node_modules/";
  const index = location.lastIndexOf(marker);
  if (index < 0) return null;
  const tail = location.slice(index + marker.length);
  if (!tail || tail.includes("node_modules/")) return null;
  if (tail.startsWith("@")) {
    const parts = tail.split("/");
    return parts.length >= 2 && parts[0] && parts[1] ? `${parts[0]}/${parts[1]}` : null;
  }
  return tail.split("/")[0] || null;
}

function isRootDirectLocation(location: string): boolean {
  return location.startsWith("node_modules/") && location.indexOf("node_modules/", "node_modules/".length) < 0;
}

function parseModernLock(
  file: string,
  content: string,
  root: Record<string, unknown>
): DependencyParseResult {
  const packages = root.packages;
  if (!isPlainObject(packages)) {
    return { components: [], errors: [parseError("invalid_lockfile", file, "npm lockfile packages must be an object.")] };
  }
  const rootPackage = isPlainObject(packages[""]) ? packages[""] as Record<string, unknown> : {};
  const components: NpmDependencyComponent[] = [];

  for (const location of Object.keys(packages).sort()) {
    if (location === "") continue;
    const value = packages[location];
    if (!isPlainObject(value) || typeof value.version !== "string" || value.version.trim() === "") continue;
    const name = nameFromPackageLocation(location);
    if (!name) continue;
    const version = value.version.trim();
    const direct = isRootDirectLocation(location);
    components.push({
      ecosystem: "npm",
      name,
      version,
      purl: createNpmPurl(name, version),
      sourceFile: file,
      sourceKind: "lockfile",
      certainty: "resolved",
      direct,
      dependencyGroup: direct ? rootGroup(rootPackage, name) : "transitive",
      sourceLine: lineForNeedle(content, JSON.stringify(location)),
      queryable: true
    });
    if (components.length > MAX_PARSED_COMPONENTS) {
      return {
        components: [],
        errors: [parseError("dependency_budget_exceeded", file, "npm lockfile exceeds the dependency component budget.")]
      };
    }
  }

  return { components: dedupeNpmComponents(components), errors: [] };
}

interface LegacyFrame {
  dependencies: Record<string, unknown>;
  depth: number;
}

function parseLegacyLock(
  file: string,
  content: string,
  root: Record<string, unknown>
): DependencyParseResult {
  if (!isPlainObject(root.dependencies)) {
    return { components: [], errors: [parseError("invalid_lockfile", file, "npm v1 lockfile dependencies must be an object.")] };
  }

  const components: NpmDependencyComponent[] = [];
  const stack: LegacyFrame[] = [{ dependencies: root.dependencies, depth: 0 }];
  let inspected = 0;

  while (stack.length > 0) {
    const frame = stack.pop() as LegacyFrame;
    const names = Object.keys(frame.dependencies).sort().reverse();
    for (const name of names) {
      inspected += 1;
      if (inspected > MAX_PARSED_COMPONENTS) {
        return {
          components: [],
          errors: [parseError("dependency_budget_exceeded", file, "npm lockfile exceeds the dependency component budget.")]
        };
      }
      const value = frame.dependencies[name];
      if (!isPlainObject(value)) continue;
      if (typeof value.version === "string" && value.version.trim() !== "") {
        const version = value.version.trim();
        const direct = frame.depth === 0;
        components.push({
          ecosystem: "npm",
          name,
          version,
          purl: createNpmPurl(name, version),
          sourceFile: file,
          sourceKind: "lockfile",
          certainty: "resolved",
          direct,
          dependencyGroup: direct
            ? value.optional === true
              ? "optional"
              : value.dev === true
                ? "development"
                : "runtime"
            : "transitive",
          sourceLine: lineForNeedle(content, JSON.stringify(name)),
          queryable: true
        });
      }
      if (isPlainObject(value.dependencies)) {
        stack.push({ dependencies: value.dependencies, depth: frame.depth + 1 });
      }
    }
  }

  return { components: dedupeNpmComponents(components), errors: [] };
}

export function parsePackageLock({ file, content }: ParseDependencyInput): DependencyParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return { components: [], errors: [parseError("invalid_lockfile", file, "npm lockfile is not valid JSON.")] };
  }
  if (!isPlainObject(parsed)) {
    return { components: [], errors: [parseError("invalid_lockfile", file, "npm lockfile root must be an object.")] };
  }

  const version = parsed.lockfileVersion;
  if (version !== 1 && version !== 2 && version !== 3) {
    return {
      components: [],
      errors: [parseError("unsupported_lockfile", file, "npm lockfileVersion must be 1, 2, or 3.")]
    };
  }

  return version === 1 ? parseLegacyLock(file, content, parsed) : parseModernLock(file, content, parsed);
}
