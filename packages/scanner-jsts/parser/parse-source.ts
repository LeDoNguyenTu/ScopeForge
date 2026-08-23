import ts from "typescript";

import { scriptKindForPath } from "./script-kind";
import type { ParseSourceInput, ParseSourceResult } from "./types";

type SourceFileWithParseDiagnostics = ts.SourceFile & {
  readonly parseDiagnostics?: readonly ts.Diagnostic[];
};

export function parseSource(input: ParseSourceInput): ParseSourceResult {
  const scriptKind = scriptKindForPath(input.file);
  if (scriptKind === null) {
    return {
      error: {
        code: "unsupported_extension",
        message: "Source file extension is not supported by the JavaScript/TypeScript parser."
      }
    };
  }

  const sourceFile = ts.createSourceFile(
    input.file,
    input.content,
    ts.ScriptTarget.Latest,
    true,
    scriptKind
  );
  const parseDiagnostics = (sourceFile as SourceFileWithParseDiagnostics).parseDiagnostics ?? [];

  if (parseDiagnostics.length > 0) {
    return {
      error: {
        code: "syntax_error",
        message: "Source file contains syntax errors."
      }
    };
  }

  return { sourceFile };
}
