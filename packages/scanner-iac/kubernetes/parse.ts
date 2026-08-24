import { LineCounter, isNode, parseAllDocuments } from "yaml";

import type {
  KubernetesLocation,
  KubernetesParseResult,
  KubernetesParserOptions,
  KubernetesPathSegment,
  ParseKubernetesYamlInput,
  ParsedKubernetesDocument
} from "./types";

const DEFAULT_MAX_DOCUMENTS = 256;
const DEFAULT_MAX_ALIAS_COUNT = 32;

function positiveInteger(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

function nonNegativeInteger(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isSafeInteger(value) && value >= 0 ? value : fallback;
}

function errorResult(code: string, file: string, message: string): KubernetesParseResult {
  return { documents: [], errors: [{ code, file, message }] };
}

function stringField(value: unknown, key: string): string | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === "string" ? candidate : null;
}

export function parseKubernetesYaml(
  input: ParseKubernetesYamlInput,
  options: KubernetesParserOptions = {}
): KubernetesParseResult {
  if (input.content.includes("\0")) {
    return errorResult(
      "invalid_kubernetes_yaml",
      input.file,
      "Kubernetes YAML contains syntax errors and was not analyzed."
    );
  }

  const maxDocuments = positiveInteger(options.maxDocuments, DEFAULT_MAX_DOCUMENTS);
  const maxAliasCount = nonNegativeInteger(options.maxAliasCount, DEFAULT_MAX_ALIAS_COUNT);
  const lineCounter = new LineCounter();

  let parsedDocuments;
  try {
    parsedDocuments = parseAllDocuments(input.content, {
      lineCounter,
      prettyErrors: false,
      strict: true,
      uniqueKeys: true,
      logLevel: "silent"
    });
  } catch {
    return errorResult(
      "invalid_kubernetes_yaml",
      input.file,
      "Kubernetes YAML contains syntax errors and was not analyzed."
    );
  }

  if (parsedDocuments.length > maxDocuments) {
    return errorResult(
      "kubernetes_document_budget_exceeded",
      input.file,
      "Kubernetes YAML exceeded the configured document budget."
    );
  }

  if (parsedDocuments.some((document) => document.errors.length > 0)) {
    return errorResult(
      "invalid_kubernetes_yaml",
      input.file,
      "Kubernetes YAML contains syntax errors and was not analyzed."
    );
  }

  const documents: ParsedKubernetesDocument[] = [];

  for (let index = 0; index < parsedDocuments.length; index += 1) {
    const document = parsedDocuments[index];
    if (!document) continue;

    let value: unknown;
    try {
      value = document.toJS({ maxAliasCount });
    } catch (error) {
      if (error instanceof ReferenceError) {
        return errorResult(
          "kubernetes_alias_budget_exceeded",
          input.file,
          "Kubernetes YAML exceeded the configured alias expansion budget."
        );
      }
      return errorResult(
        "invalid_kubernetes_yaml",
        input.file,
        "Kubernetes YAML contains syntax errors and was not analyzed."
      );
    }

    if (value === null || value === undefined) continue;

    const location = (path: readonly KubernetesPathSegment[]): KubernetesLocation | null => {
      let node: unknown;
      try {
        node = document.getIn(path, true);
      } catch {
        return null;
      }
      if (!isNode(node) || !node.range) return null;

      const start = lineCounter.linePos(node.range[0]);
      const end = lineCounter.linePos(node.range[1]);
      return {
        startLine: start.line,
        startColumn: start.col,
        endLine: end.line,
        endColumn: end.col
      };
    };

    documents.push({
      index,
      apiVersion: stringField(value, "apiVersion"),
      kind: stringField(value, "kind"),
      value,
      location
    });
  }

  return { documents, errors: [] };
}
