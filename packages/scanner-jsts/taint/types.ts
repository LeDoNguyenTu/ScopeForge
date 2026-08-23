import type ts from "typescript";

export interface TaintBudget {
  maxSteps: number;
  steps: number;
}

export interface ExpressRouteHandler {
  callback: ts.ArrowFunction | ts.FunctionExpression;
  requestName: string;
  routeMethod: string;
}

export type CommandSinkMethod = "exec" | "execSync";

export type CommandSinkBinding =
  | {
      kind: "direct";
      localName: string;
      method: CommandSinkMethod;
    }
  | {
      kind: "namespace";
      localName: string;
    };

export interface TaintBindingResult {
  routeHandlers: ExpressRouteHandler[];
  commandSinks: CommandSinkBinding[];
  exceeded: boolean;
}

export function chargeTaintBudget(budget: TaintBudget, amount = 1): boolean {
  if (!Number.isSafeInteger(budget.maxSteps) || budget.maxSteps <= 0) return false;
  if (!Number.isSafeInteger(amount) || amount <= 0) return false;
  if (budget.steps + amount > budget.maxSteps) return false;
  budget.steps += amount;
  return true;
}
