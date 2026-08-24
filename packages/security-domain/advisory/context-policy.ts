import type { AdvisoryContextItem, PreparedAdvisoryContext } from "./types";

export type AdvisoryExecution = "local" | "remote";

export interface AdvisoryContextPolicy {
  execution: AdvisoryExecution;
  allowSensitiveRemote: boolean;
  maxItems: number;
  maxCharacters: number;
}

function assertBudget(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer`);
  }
}

function isAllowedByClassification(
  item: AdvisoryContextItem,
  policy: AdvisoryContextPolicy,
): boolean {
  if (item.classification === "secret") {
    return false;
  }

  if (
    policy.execution === "remote" &&
    item.classification === "sensitive" &&
    !policy.allowSensitiveRemote
  ) {
    return false;
  }

  return true;
}

function preparedContext(items: AdvisoryContextItem[]): PreparedAdvisoryContext {
  return items as PreparedAdvisoryContext;
}

export function buildAdvisoryContext(
  items: readonly AdvisoryContextItem[],
  policy: AdvisoryContextPolicy,
): PreparedAdvisoryContext {
  assertBudget(policy.maxItems, "maxItems");
  assertBudget(policy.maxCharacters, "maxCharacters");

  if (policy.maxItems === 0 || policy.maxCharacters === 0) {
    return preparedContext([]);
  }

  const output: AdvisoryContextItem[] = [];
  let charactersUsed = 0;

  for (const item of items) {
    if (output.length >= policy.maxItems) {
      break;
    }

    if (!isAllowedByClassification(item, policy)) {
      continue;
    }

    const remaining = policy.maxCharacters - charactersUsed;
    if (remaining <= 0) {
      break;
    }

    const summary = item.summary.slice(0, remaining);
    if (summary.length === 0) {
      break;
    }

    output.push({ ...item, summary });
    charactersUsed += summary.length;

    if (summary.length < item.summary.length) {
      break;
    }
  }

  return preparedContext(output);
}
