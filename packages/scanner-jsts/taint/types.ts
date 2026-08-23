import type ts from "typescript";

export interface TaintBudget {
  maxSteps: number;
  steps: number;
  exceeded?: boolean;
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

export type TaintOriginKind = "express-query" | "express-params" | "express-body";

export interface TaintOrigin {
  kind: TaintOriginKind;
  line: number;
}

export type TaintTraceKind = "source" | "propagation" | "sink";

export interface TaintTraceStep {
  kind: TaintTraceKind;
  line: number;
  label: string;
}

export interface TaintValue {
  tainted: boolean;
  origin?: TaintOrigin;
  trace: TaintTraceStep[];
}

export type CommandTaintSink = "child_process.exec" | "child_process.execSync";

export interface CommandTaintFlow {
  sinkNode: ts.CallExpression;
  sink: CommandTaintSink;
  source: TaintOrigin;
  trace: TaintTraceStep[];
}

export interface HandlerTaintResult {
  sinkFlows: CommandTaintFlow[];
  exceeded: boolean;
}

export function chargeTaintBudget(budget: TaintBudget, amount = 1): boolean {
  if (
    budget.exceeded === true ||
    !Number.isSafeInteger(budget.maxSteps) ||
    budget.maxSteps <= 0 ||
    !Number.isSafeInteger(amount) ||
    amount <= 0 ||
    budget.steps + amount > budget.maxSteps
  ) {
    budget.exceeded = true;
    return false;
  }
  budget.steps += amount;
  return true;
}
