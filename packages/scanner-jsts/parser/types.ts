import type ts from "typescript";

export type ParserErrorCode = "syntax_error" | "unsupported_extension";

export interface ParserError {
  code: ParserErrorCode;
  message: string;
}

export interface ParseSourceInput {
  file: string;
  content: string;
}

export type ParseSourceResult =
  | { sourceFile: ts.SourceFile }
  | { error: ParserError };
