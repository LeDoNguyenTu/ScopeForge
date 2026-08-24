import { LineCounter, isNode, parseAllDocuments } from "yaml";

import type {
  GitHubActionsParseResult,
  GitHubActionsParserOptions,
  GitHubActionsPathSegment,
  ParseGitHubActionsYamlInput,
  ParsedGitHubActionsWorkflow
} from "./types";

const DEFAULT_MAX_ALIAS_COUNT = 32;

function nonNegativeInteger(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isSafeInteger(value) && value >= 0 ? value : fallback;
}

function errorResult(code: string, file: string, message: string): GitHubActionsParseResult {
  return { workflow: null, errors: [{ code, file, message }] };
}

export function parseGitHubActionsYaml(
  input: ParseGitHubActionsYamlInput,
  options: GitHubActionsParserOptions = {}
): GitHubActionsParseResult {
  if (input.content.includes("\0")) {
    return errorResult(
      "invalid_github_actions_yaml",
      input.file,
      "GitHub Actions YAML contains syntax errors and was not analyzed."
    );
  }

  const maxAliasCount = nonNegativeInteger(options.maxAliasCount, DEFAULT_MAX_ALIAS_COUNT);
  const lineCounter = new LineCounter();

  let documents;
  try {
    documents = parseAllDocuments(input.content, {
      lineCounter,
      prettyErrors: false,
      strict: true,
      uniqueKeys: true,
      logLevel: "silent"
    });
  } catch {
    return errorResult(
      "invalid_github_actions_yaml",
      input.file,
      "GitHub Actions YAML contains syntax errors and was not analyzed."
    );
  }

  if (documents.length !== 1 || documents[0]?.errors.length) {
    return errorResult(
      "invalid_github_actions_yaml",
      input.file,
      "GitHub Actions YAML contains syntax errors and was not analyzed."
    );
  }

  const document = documents[0];
  if (!document) {
    return errorResult(
      "invalid_github_actions_yaml",
      input.file,
      "GitHub Actions YAML contains syntax errors and was not analyzed."
    );
  }

  let value: unknown;
  try {
    value = document.toJS({ maxAliasCount });
  } catch (error) {
    if (error instanceof ReferenceError) {
      return errorResult(
        "github_actions_alias_budget_exceeded",
        input.file,
        "GitHub Actions YAML exceeded the configured alias expansion budget."
      );
    }
    return errorResult(
      "invalid_github_actions_yaml",
      input.file,
      "GitHub Actions YAML contains syntax errors and was not analyzed."
    );
  }

  const workflow: ParsedGitHubActionsWorkflow = {
    value,
    location(path: readonly GitHubActionsPathSegment[]) {
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
    }
  };

  return { workflow, errors: [] };
}
