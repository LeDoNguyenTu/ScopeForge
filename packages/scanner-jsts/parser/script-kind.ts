import ts from "typescript";
import { extname } from "node:path";

const SCRIPT_KIND_BY_EXTENSION: Record<string, ts.ScriptKind> = {
  ".js": ts.ScriptKind.JS,
  ".jsx": ts.ScriptKind.JSX,
  ".mjs": ts.ScriptKind.JS,
  ".cjs": ts.ScriptKind.JS,
  ".ts": ts.ScriptKind.TS,
  ".tsx": ts.ScriptKind.TSX,
  ".mts": ts.ScriptKind.TS,
  ".cts": ts.ScriptKind.TS
};

export function scriptKindForPath(file: string): ts.ScriptKind | null {
  return SCRIPT_KIND_BY_EXTENSION[extname(file).toLowerCase()] ?? null;
}
