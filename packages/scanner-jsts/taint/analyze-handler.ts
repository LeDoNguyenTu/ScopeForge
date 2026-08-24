import ts from "typescript";

import { evaluateTaintExpression } from "./value";
import {
  chargeTaintBudget,
  type CommandSinkBinding,
  type CommandTaintFlow,
  type CommandTaintSink,
  type HandlerTaintResult,
  type TaintBudget,
  type TaintValue
} from "./types";

export interface AnalyzeExpressHandlerInput {
  handler: ts.ArrowFunction | ts.FunctionExpression;
  requestName: string;
  commandSinks: readonly CommandSinkBinding[];
  sourceFile: ts.SourceFile;
  budget: TaintBudget;
}

function exceededResult(): HandlerTaintResult {
  return { sinkFlows: [], exceeded: true };
}

function sinkForCall(
  call: ts.CallExpression,
  commandSinks: readonly CommandSinkBinding[],
  budget: TaintBudget
): CommandTaintSink | null {
  for (const binding of commandSinks) {
    if (!chargeTaintBudget(budget)) return null;

    if (binding.kind === "direct") {
      if (ts.isIdentifier(call.expression) && call.expression.text === binding.localName) {
        return binding.method === "exec" ? "child_process.exec" : "child_process.execSync";
      }
      continue;
    }

    if (
      ts.isPropertyAccessExpression(call.expression) &&
      ts.isIdentifier(call.expression.expression) &&
      call.expression.expression.text === binding.localName &&
      (call.expression.name.text === "exec" || call.expression.name.text === "execSync")
    ) {
      return call.expression.name.text === "exec" ? "child_process.exec" : "child_process.execSync";
    }
  }

  return null;
}

function lineOf(node: ts.Node, sourceFile: ts.SourceFile): number {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

export function analyzeExpressHandler(input: AnalyzeExpressHandlerInput): HandlerTaintResult {
  const environment = new Map<string, TaintValue>();
  const sinkFlows: CommandTaintFlow[] = [];

  function evaluate(expression: ts.Expression): TaintValue {
    return evaluateTaintExpression({
      expression,
      requestName: input.requestName,
      environment,
      sourceFile: input.sourceFile,
      budget: input.budget
    });
  }

  function inspectSink(call: ts.CallExpression): void {
    if (input.budget.exceeded) return;
    const sink = sinkForCall(call, input.commandSinks, input.budget);
    if (!sink || input.budget.exceeded) return;

    const command = call.arguments[0];
    if (!command) return;
    const value = evaluate(command);
    if (!value.tainted || !value.origin || input.budget.exceeded) return;

    if (!chargeTaintBudget(input.budget)) return;
    sinkFlows.push({
      sinkNode: call,
      sink,
      source: value.origin,
      trace: [
        ...value.trace,
        {
          kind: "sink",
          line: lineOf(call, input.sourceFile),
          label: sink === "child_process.exec" ? "Sink: child_process.exec" : "Sink: child_process.execSync"
        }
      ]
    });
  }

  function inspectRootExpression(expression: ts.Expression): void {
    if (!chargeTaintBudget(input.budget)) return;
    if (ts.isCallExpression(expression)) inspectSink(expression);
  }

  function processStatement(statement: ts.Statement): void {
    if (!chargeTaintBudget(input.budget)) return;

    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (!chargeTaintBudget(input.budget)) return;
        if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue;
        inspectRootExpression(declaration.initializer);
        if (input.budget.exceeded) return;
        environment.set(declaration.name.text, evaluate(declaration.initializer));
        if (input.budget.exceeded) return;
      }
      return;
    }

    if (ts.isExpressionStatement(statement)) {
      const expression = statement.expression;
      if (
        ts.isBinaryExpression(expression) &&
        expression.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        ts.isIdentifier(expression.left)
      ) {
        inspectRootExpression(expression.right);
        if (input.budget.exceeded) return;
        environment.set(expression.left.text, evaluate(expression.right));
        return;
      }
      inspectRootExpression(expression);
      return;
    }

    if (ts.isReturnStatement(statement) && statement.expression) {
      inspectRootExpression(statement.expression);
      return;
    }

    environment.clear();
  }

  if (ts.isBlock(input.handler.body)) {
    for (const statement of input.handler.body.statements) {
      processStatement(statement);
      if (input.budget.exceeded) return exceededResult();
    }
  } else {
    inspectRootExpression(input.handler.body);
  }

  if (input.budget.exceeded) return exceededResult();
  return { sinkFlows, exceeded: false };
}
