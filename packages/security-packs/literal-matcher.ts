import type { SecurityPackRuleV1 } from "./contracts";
import { SecurityPackError } from "./error";
import { compileSecurityPackPathPattern } from "./path-pattern";

export interface SecurityPackLiteralMatch {
  readonly byteOffset: number;
  readonly byteLength: number;
  readonly literalOrdinal: number;
  readonly startLine: number;
  readonly startColumn: number;
  readonly endLine: number;
  readonly endColumn: number;
}

interface LiteralCandidate {
  readonly byteOffset: number;
  readonly byteLength: number;
  readonly literalOrdinal: number;
}

function isAscii(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    if (value.charCodeAt(index) > 0x7f) return false;
  }
  return true;
}

function asciiLowercaseBytes(value: Buffer): Buffer {
  const lowered = Buffer.from(value);
  for (let index = 0; index < lowered.length; index += 1) {
    const byte = lowered[index]!;
    if (byte >= 0x41 && byte <= 0x5a) lowered[index] = byte + 0x20;
  }
  return lowered;
}

function assertCaseModeSupported(rule: SecurityPackRuleV1): void {
  if (rule.matcher.caseSensitive) return;
  const allLiterals = [...rule.matcher.literals, ...rule.matcher.absentLiterals];
  if (allLiterals.some((literal) => !isAscii(literal))) {
    throw new SecurityPackError(
      "PACK_MANIFEST_INVALID",
      "Case-insensitive Security Pack literals must contain ASCII bytes only.",
      "matcher.caseSensitive",
    );
  }
}

function matchesPath(rule: SecurityPackRuleV1, file: string): boolean {
  const included = rule.matcher.include.some((pattern) =>
    compileSecurityPackPathPattern(pattern).matches(file),
  );
  if (!included) return false;
  return !rule.matcher.exclude.some((pattern) =>
    compileSecurityPackPathPattern(pattern).matches(file),
  );
}

function locationAt(bytes: Buffer, byteOffset: number): { line: number; column: number } {
  let line = 1;
  let column = 1;
  for (let index = 0; index < byteOffset; index += 1) {
    if (bytes[index] === 0x0a) {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }
  return { line, column };
}

function candidateFor(
  haystack: Buffer,
  literal: string,
  literalOrdinal: number,
  caseSensitive: boolean,
): LiteralCandidate | null {
  const literalBytes = Buffer.from(literal, "utf8");
  const needle = caseSensitive ? literalBytes : asciiLowercaseBytes(literalBytes);
  const byteOffset = haystack.indexOf(needle);
  return byteOffset < 0
    ? null
    : { byteOffset, byteLength: literalBytes.length, literalOrdinal };
}

function earlierCandidate(
  current: LiteralCandidate | null,
  candidate: LiteralCandidate,
): LiteralCandidate {
  if (current === null) return candidate;
  if (candidate.byteOffset < current.byteOffset) return candidate;
  if (candidate.byteOffset === current.byteOffset && candidate.literalOrdinal < current.literalOrdinal) {
    return candidate;
  }
  return current;
}

export function matchStaticLiteral(
  rule: SecurityPackRuleV1,
  file: string,
  bytes: Buffer,
): SecurityPackLiteralMatch | null {
  if (!matchesPath(rule, file)) return null;
  assertCaseModeSupported(rule);

  const haystack = rule.matcher.caseSensitive ? bytes : asciiLowercaseBytes(bytes);

  for (const absentLiteral of rule.matcher.absentLiterals) {
    const needleBytes = Buffer.from(absentLiteral, "utf8");
    const needle = rule.matcher.caseSensitive ? needleBytes : asciiLowercaseBytes(needleBytes);
    if (haystack.indexOf(needle) >= 0) return null;
  }

  let selected: LiteralCandidate | null = null;
  let matchedCount = 0;

  for (let literalOrdinal = 0; literalOrdinal < rule.matcher.literals.length; literalOrdinal += 1) {
    const candidate = candidateFor(
      haystack,
      rule.matcher.literals[literalOrdinal]!,
      literalOrdinal,
      true,
    );
    if (candidate === null) {
      if (rule.matcher.mode === "all") return null;
      continue;
    }
    matchedCount += 1;
    selected = earlierCandidate(selected, candidate);
  }

  if (selected === null) return null;
  if (rule.matcher.mode === "all" && matchedCount !== rule.matcher.literals.length) return null;

  const start = locationAt(bytes, selected.byteOffset);
  const end = locationAt(bytes, selected.byteOffset + selected.byteLength);

  return {
    byteOffset: selected.byteOffset,
    byteLength: selected.byteLength,
    literalOrdinal: selected.literalOrdinal,
    startLine: start.line,
    startColumn: start.column,
    endLine: end.line,
    endColumn: end.column,
  };
}
