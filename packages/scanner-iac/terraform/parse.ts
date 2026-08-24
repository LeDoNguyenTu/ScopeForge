import { parse } from "@cdktf/hcl2json";

import type {
  ParsedTerraformBlock,
  ParseTerraformHclInput,
  TerraformBlockKind,
  TerraformParseResult,
  TerraformParserOptions,
  TerraformRecord
} from "./types";

const DEFAULT_MAX_BLOCKS = 4_096;

interface TerraformBlockHeader {
  kind: TerraformBlockKind;
  type: string;
  name: string;
  startLine: number;
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

function errorResult(code: string, file: string, message: string): TerraformParseResult {
  return { blocks: [], errors: [{ code, file, message }] };
}

function asRecord(value: unknown): TerraformRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as TerraformRecord)
    : null;
}

function stripComments(line: string, state: { inBlockComment: boolean }): string {
  let output = "";
  let inString = false;
  let escaped = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index] ?? "";
    const next = line[index + 1] ?? "";

    if (state.inBlockComment) {
      if (character === "*" && next === "/") {
        state.inBlockComment = false;
        output += "  ";
        index += 1;
      } else {
        output += " ";
      }
      continue;
    }

    if (inString) {
      output += character;
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
      output += character;
      continue;
    }
    if (character === "/" && next === "*") {
      state.inBlockComment = true;
      output += "  ";
      index += 1;
      continue;
    }
    if (character === "#" || (character === "/" && next === "/")) break;
    output += character;
  }

  return output;
}

function braceDelta(line: string): number {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (const character of line) {
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
      continue;
    }
    if (character === "{") depth += 1;
    if (character === "}") depth -= 1;
  }

  return depth;
}

function heredocMarker(line: string): { delimiter: string; stripTabs: boolean } | null {
  let inString = false;
  let escaped = false;

  for (let index = 0; index < line.length - 1; index += 1) {
    const character = line[index] ?? "";
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') {
      inString = true;
      continue;
    }
    if (character !== "<" || line[index + 1] !== "<") continue;

    const rest = line.slice(index + 2);
    const match = rest.match(/^(-)?\s*([A-Za-z_][A-Za-z0-9_-]*)/);
    if (match?.[2]) return { delimiter: match[2], stripTabs: match[1] === "-" };
  }

  return null;
}

function findBlockHeaders(content: string): TerraformBlockHeader[] {
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  const headers: TerraformBlockHeader[] = [];
  const commentState = { inBlockComment: false };
  let depth = 0;
  let heredoc: { delimiter: string; stripTabs: boolean } | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const physical = lines[index] ?? "";
    if (heredoc) {
      const candidate = heredoc.stripTabs ? physical.replace(/^\t+/, "") : physical;
      if (candidate.trimEnd() === heredoc.delimiter) heredoc = null;
      continue;
    }

    const code = stripComments(physical, commentState);
    if (depth === 0) {
      const match = code.match(/^\s*(resource|data)\s+"([^"]+)"\s+"([^"]+)"\s*\{/);
      if (match?.[1] && match[2] && match[3]) {
        headers.push({
          kind: match[1] as TerraformBlockKind,
          type: match[2],
          name: match[3],
          startLine: index + 1
        });
      }
    }

    depth += braceDelta(code);
    const marker = heredocMarker(code);
    if (marker) heredoc = marker;
  }

  return headers;
}

function headerKey(kind: TerraformBlockKind, type: string, name: string): string {
  return `${kind}\u0000${type}\u0000${name}`;
}

function normalizeBlocks(parsed: TerraformRecord, headers: TerraformBlockHeader[]): ParsedTerraformBlock[] {
  const headerQueues = new Map<string, TerraformBlockHeader[]>();
  for (const header of headers) {
    const key = headerKey(header.kind, header.type, header.name);
    const queue = headerQueues.get(key) ?? [];
    queue.push(header);
    headerQueues.set(key, queue);
  }

  const blocks: ParsedTerraformBlock[] = [];
  for (const kind of ["resource", "data"] as const) {
    const types = asRecord(parsed[kind]);
    if (!types) continue;

    for (const [type, namesValue] of Object.entries(types)) {
      const names = asRecord(namesValue);
      if (!names) continue;

      for (const [name, rawInstances] of Object.entries(names)) {
        const instances = Array.isArray(rawInstances) ? rawInstances : [rawInstances];
        for (const instance of instances) {
          const value = asRecord(instance);
          if (!value) continue;
          const key = headerKey(kind, type, name);
          const queue = headerQueues.get(key);
          const header = queue?.shift();
          blocks.push({ kind, type, name, value, startLine: header?.startLine ?? 1 });
        }
      }
    }
  }

  return blocks;
}

export async function parseTerraformHcl(
  input: ParseTerraformHclInput,
  options: TerraformParserOptions = {}
): Promise<TerraformParseResult> {
  const maxBlocks = positiveInteger(options.maxBlocks, DEFAULT_MAX_BLOCKS);
  if (input.content.includes("\0")) {
    return errorResult(
      "invalid_terraform_hcl",
      input.file,
      "Terraform HCL contains syntax errors and was not analyzed."
    );
  }

  try {
    const parsed = (await parse(input.file, input.content)) as TerraformRecord;
    const blocks = normalizeBlocks(parsed, findBlockHeaders(input.content));
    if (blocks.length > maxBlocks) {
      return errorResult(
        "terraform_block_budget_exceeded",
        input.file,
        "Terraform HCL exceeded the configured block budget."
      );
    }
    return { blocks, errors: [] };
  } catch {
    return errorResult(
      "invalid_terraform_hcl",
      input.file,
      "Terraform HCL contains syntax errors and was not analyzed."
    );
  }
}
