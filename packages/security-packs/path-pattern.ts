import { SecurityPackError } from "./error";

type SegmentToken =
  | { kind: "literal"; value: string }
  | { kind: "star" }
  | { kind: "question" };

type CompiledSegment =
  | { kind: "double-star" }
  | { kind: "segment"; tokens: readonly SegmentToken[] };

type OperationCounter = () => void;

const NO_OPERATION_COUNTER: OperationCounter = () => undefined;
const UNSUPPORTED_PATTERN_CHARACTERS = new Set(["[", "]", "{", "}", "(", ")"]);

export interface CompiledSecurityPackPathPattern {
  readonly source: string;
  matches(repositoryPath: string): boolean;
}

function invalidPattern(): never {
  throw new SecurityPackError(
    "PACK_MANIFEST_INVALID",
    "Security Pack path pattern is invalid or unsupported.",
  );
}

function invalidRepositoryPath(): never {
  throw new SecurityPackError(
    "PACK_PATH_INVALID",
    "Security Pack matcher requires a canonical repository-relative path.",
  );
}

function hasDrivePrefix(value: string): boolean {
  if (value.length < 2 || value[1] !== ":") return false;
  const first = value.charCodeAt(0);
  return (first >= 65 && first <= 90) || (first >= 97 && first <= 122);
}

function splitCanonicalPath(value: string, error: () => never): readonly string[] {
  if (!value || value.startsWith("/") || value.includes("\\") || hasDrivePrefix(value)) {
    return error();
  }

  const segments = value.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
    return error();
  }
  return segments;
}

function compileSegment(segment: string): CompiledSegment {
  if (segment === "**") return { kind: "double-star" };
  if (segment.includes("**")) return invalidPattern();

  const tokens: SegmentToken[] = [];
  for (let index = 0; index < segment.length; index += 1) {
    const character = segment[index]!;
    if (UNSUPPORTED_PATTERN_CHARACTERS.has(character)) return invalidPattern();
    if (character === "*") {
      if (tokens.at(-1)?.kind !== "star") tokens.push({ kind: "star" });
    } else if (character === "?") {
      tokens.push({ kind: "question" });
    } else {
      tokens.push({ kind: "literal", value: character });
    }
  }
  return { kind: "segment", tokens };
}

function matchSegment(
  tokens: readonly SegmentToken[],
  value: string,
  countOperation: OperationCounter,
): boolean {
  let previous = new Array<boolean>(value.length + 1).fill(false);
  previous[0] = true;

  for (const token of tokens) {
    const next = new Array<boolean>(value.length + 1).fill(false);
    if (token.kind === "star") {
      countOperation();
      next[0] = previous[0]!;
      for (let index = 1; index <= value.length; index += 1) {
        countOperation();
        next[index] = previous[index]! || next[index - 1]!;
      }
    } else {
      for (let index = 1; index <= value.length; index += 1) {
        countOperation();
        next[index] = previous[index - 1]!
          && (token.kind === "question" || value[index - 1] === token.value);
      }
    }
    previous = next;
  }

  return previous[value.length]!;
}

/**
 * Compiles a bounded Security Pack glob without RegExp or backtracking.
 * The optional counter is called once per dynamic-programming cell. A match
 * visits at most `2 * source.length * (repositoryPath.length + 1)` cells.
 */
export function compileSecurityPackPathPattern(
  pattern: string,
  countOperation: OperationCounter = NO_OPERATION_COUNTER,
): CompiledSecurityPackPathPattern {
  const segments = splitCanonicalPath(pattern, invalidPattern).map(compileSegment);

  return {
    source: pattern,
    matches(repositoryPath: string): boolean {
      const pathSegments = splitCanonicalPath(repositoryPath, invalidRepositoryPath);
      let previous = new Array<boolean>(segments.length + 1).fill(false);
      previous[0] = true;

      for (let patternIndex = 1; patternIndex <= segments.length; patternIndex += 1) {
        countOperation();
        previous[patternIndex] = segments[patternIndex - 1]!.kind === "double-star"
          && previous[patternIndex - 1]!;
      }

      for (const pathSegment of pathSegments) {
        const current = new Array<boolean>(segments.length + 1).fill(false);
        for (let patternIndex = 1; patternIndex <= segments.length; patternIndex += 1) {
          countOperation();
          const compiledSegment = segments[patternIndex - 1]!;
          current[patternIndex] = compiledSegment.kind === "double-star"
            ? previous[patternIndex]! || current[patternIndex - 1]!
            : previous[patternIndex - 1]!
              && matchSegment(compiledSegment.tokens, pathSegment, countOperation);
        }
        previous = current;
      }

      return previous[segments.length]!;
    },
  };
}
