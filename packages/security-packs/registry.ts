import { compareText } from "../scanner-core/determinism/compare-text";
import {
  SECURITY_PACK_LIMITS,
  type LoadedSecurityPack,
  type SecurityPackRuleV1,
} from "./contracts";
import { SecurityPackError } from "./error";
import {
  type CompiledSecurityPackPathPattern,
  compileSecurityPackPathPattern,
} from "./path-pattern";
import {
  assertSecurityPackCompatibility,
  loadSecurityPackManifest,
} from "./parse";

export interface RegisteredSecurityPackRule {
  readonly pack: LoadedSecurityPack;
  readonly rule: SecurityPackRuleV1;
  readonly publishedRuleId: string;
  readonly matchesPath: (repositoryPath: string) => boolean;
}

export interface SecurityPackRegistry {
  readonly packs: readonly LoadedSecurityPack[];
  readonly rules: readonly RegisteredSecurityPackRule[];
}

export interface LoadSecurityPackRegistryOptions {
  readonly currentScopeForgeVersion: string;
  readonly reservedRuleIds?: readonly string[];
}

function compilePathMatcher(rule: SecurityPackRuleV1): (repositoryPath: string) => boolean {
  const includes = rule.matcher.include.map(compileSecurityPackPathPattern);
  const excludes = rule.matcher.exclude.map(compileSecurityPackPathPattern);

  return (repositoryPath: string): boolean => {
    if (!includes.some((pattern: CompiledSecurityPackPathPattern) => pattern.matches(repositoryPath))) {
      return false;
    }
    return !excludes.some((pattern: CompiledSecurityPackPathPattern) => pattern.matches(repositoryPath));
  };
}

function comparePacks(left: LoadedSecurityPack, right: LoadedSecurityPack): number {
  return compareText(left.manifest.packId, right.manifest.packId)
    || compareText(left.manifest.version, right.manifest.version)
    || compareText(left.packDirectory, right.packDirectory);
}

function compareRegisteredRules(
  left: RegisteredSecurityPackRule,
  right: RegisteredSecurityPackRule,
): number {
  return compareText(left.publishedRuleId, right.publishedRuleId)
    || compareText(left.pack.manifest.version, right.pack.manifest.version)
    || compareText(left.pack.packDirectory, right.pack.packDirectory);
}

export async function loadSecurityPackRegistry(
  packDirectories: readonly string[],
  options: LoadSecurityPackRegistryOptions,
): Promise<SecurityPackRegistry> {
  if (
    packDirectories.length < 1
    || packDirectories.length > SECURITY_PACK_LIMITS.selectedPacks
  ) {
    throw new SecurityPackError(
      "PACK_BUDGET_EXCEEDED",
      "Selected pack count exceeds the fixed limit.",
    );
  }

  const packs = await Promise.all(packDirectories.map(loadSecurityPackManifest));
  const roots = new Set<string>();
  const publishedIds = new Set(options.reservedRuleIds ?? []);
  let selectedRules = 0;

  for (const pack of packs) {
    assertSecurityPackCompatibility(pack.manifest, options.currentScopeForgeVersion);

    if (roots.has(pack.packDirectory)) {
      throw new SecurityPackError(
        "PACK_RULE_COLLISION",
        "A canonical pack directory was selected more than once.",
      );
    }
    roots.add(pack.packDirectory);

    selectedRules += pack.manifest.rules.length;
    if (selectedRules > SECURITY_PACK_LIMITS.selectedRules) {
      throw new SecurityPackError(
        "PACK_BUDGET_EXCEEDED",
        "Selected pack rule count exceeds the fixed limit.",
      );
    }

    for (const rule of pack.manifest.rules) {
      const publishedRuleId = `pack/${pack.manifest.packId}/${rule.id}`;
      if (publishedIds.has(publishedRuleId)) {
        throw new SecurityPackError(
          "PACK_RULE_COLLISION",
          "Published pack rule identity is not unique.",
        );
      }
      publishedIds.add(publishedRuleId);
    }
  }

  const orderedPacks = [...packs].sort(comparePacks);
  const rules: RegisteredSecurityPackRule[] = [];

  for (const pack of orderedPacks) {
    for (const rule of pack.manifest.rules) {
      rules.push(Object.freeze({
        pack,
        rule,
        publishedRuleId: `pack/${pack.manifest.packId}/${rule.id}`,
        matchesPath: compilePathMatcher(rule),
      }));
    }
  }
  rules.sort(compareRegisteredRules);

  return Object.freeze({
    packs: Object.freeze(orderedPacks),
    rules: Object.freeze(rules),
  });
}
