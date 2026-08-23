export type IgnoreMatcher = (repositoryPath: string, isDirectory?: boolean) => boolean;

function normalizeRepositoryPath(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/{2,}/g, "/");
}

function escapeRegexCharacter(character: string): string {
  return /[\\^$+?.()|{}\[\]]/.test(character) ? `\\${character}` : character;
}

function globToRegexSource(glob: string): string {
  let source = "";

  for (let index = 0; index < glob.length; index += 1) {
    const character = glob[index];

    if (character === "*") {
      if (glob[index + 1] === "*") {
        source += ".*";
        index += 1;
      } else {
        source += "[^/]*";
      }
      continue;
    }

    if (character === "?") {
      source += "[^/]";
      continue;
    }

    source += escapeRegexCharacter(character);
  }

  return source;
}

function compilePattern(rawPattern: string): RegExp | null {
  let pattern = rawPattern.trim();
  if (!pattern || pattern.startsWith("#") || pattern.startsWith("!")) return null;

  const anchored = pattern.startsWith("/");
  if (anchored) pattern = pattern.slice(1);

  pattern = normalizeRepositoryPath(pattern);
  if (pattern.endsWith("/")) pattern += "**";
  if (!pattern) return null;

  const hasSlash = pattern.includes("/");
  const source = globToRegexSource(pattern);

  if (anchored) return new RegExp(`^${source}(?:$|/)`);
  if (hasSlash) return new RegExp(`(?:^|/)${source}(?:$|/)`);
  return new RegExp(`(?:^|/)${source}(?:$|/)`);
}

export function compileIgnorePatterns(content: string): IgnoreMatcher {
  const patterns = content
    .split(/\r?\n/)
    .map(compilePattern)
    .filter((pattern): pattern is RegExp => pattern !== null);

  return (repositoryPath: string) => {
    const normalizedPath = normalizeRepositoryPath(repositoryPath);
    return patterns.some((pattern) => pattern.test(normalizedPath));
  };
}
