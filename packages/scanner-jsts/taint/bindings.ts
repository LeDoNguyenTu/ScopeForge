import ts from "typescript";

import {
  chargeTaintBudget,
  type CommandSinkBinding,
  type CommandSinkMethod,
  type ExpressRouteHandler,
  type TaintBindingResult,
  type TaintBudget
} from "./types";

const EXPRESS_MODULE = "express";
const CHILD_PROCESS_MODULES = new Set(["child_process", "node:child_process"]);
const ROUTE_METHODS = new Set(["get", "post", "put", "patch", "delete", "all", "use"]);
const COMMAND_METHODS = new Set<CommandSinkMethod>(["exec", "execSync"]);

type ExpressFactoryKind = "app" | "router" | "namespace";

interface ExpressFactoryCandidate {
  localName: string;
  kind: ExpressFactoryKind;
  source: "import" | "require";
}

interface CommandSinkCandidate {
  binding: CommandSinkBinding;
  source: "import" | "require";
}

interface ExpressInstanceCandidate {
  localName: string;
  factoryName: string;
  factoryKind: "call" | "router-property";
}

interface RouteCandidate {
  receiverName: string;
  method: string;
  callbacks: Array<ts.ArrowFunction | ts.FunctionExpression>;
}

function moduleSpecifierText(node: ts.Expression): string | null {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) ? node.text : null;
}

function requireSpecifier(node: ts.Expression | undefined): string | null {
  if (!node || !ts.isCallExpression(node)) return null;
  if (!ts.isIdentifier(node.expression) || node.expression.text !== "require") return null;
  if (node.arguments.length !== 1) return null;
  return moduleSpecifierText(node.arguments[0] as ts.Expression);
}

function increment(counts: Map<string, number>, name: string): void {
  counts.set(name, (counts.get(name) ?? 0) + 1);
}

function recordBindingName(counts: Map<string, number>, name: ts.BindingName): void {
  if (ts.isIdentifier(name)) {
    increment(counts, name.text);
    return;
  }

  for (const element of name.elements) {
    if (ts.isOmittedExpression(element)) continue;
    recordBindingName(counts, element.name);
  }
}

function recordRuntimeDeclaration(node: ts.Node, counts: Map<string, number>): void {
  if (ts.isVariableDeclaration(node) || ts.isParameter(node)) {
    recordBindingName(counts, node.name);
    return;
  }

  if (
    (ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isClassDeclaration(node) ||
      ts.isClassExpression(node)) &&
    node.name
  ) {
    increment(counts, node.name.text);
    return;
  }

  if (ts.isImportDeclaration(node)) {
    const clause = node.importClause;
    if (!clause || clause.isTypeOnly) return;
    if (clause.name) increment(counts, clause.name.text);
    if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
      increment(counts, clause.namedBindings.name.text);
      return;
    }
    if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const element of clause.namedBindings.elements) {
        if (!element.isTypeOnly) increment(counts, element.name.text);
      }
    }
    return;
  }

  if (ts.isImportEqualsDeclaration(node) && !node.isTypeOnly) {
    increment(counts, node.name.text);
    return;
  }

  if (ts.isEnumDeclaration(node)) {
    increment(counts, node.name.text);
  }
}

function isTopLevelConstDeclaration(node: ts.VariableDeclaration): boolean {
  const declarationList = node.parent;
  if (!ts.isVariableDeclarationList(declarationList)) return false;
  if ((declarationList.flags & ts.NodeFlags.Const) === 0) return false;
  const statement = declarationList.parent;
  return ts.isVariableStatement(statement) && ts.isSourceFile(statement.parent);
}

function collectImportCandidates(
  node: ts.ImportDeclaration,
  expressFactories: ExpressFactoryCandidate[],
  commandSinks: CommandSinkCandidate[]
): void {
  const specifier = moduleSpecifierText(node.moduleSpecifier);
  const clause = node.importClause;
  if (!specifier || !clause || clause.isTypeOnly) return;

  if (specifier === EXPRESS_MODULE) {
    if (clause.name) {
      expressFactories.push({ localName: clause.name.text, kind: "app", source: "import" });
    }

    if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
      expressFactories.push({
        localName: clause.namedBindings.name.text,
        kind: "namespace",
        source: "import"
      });
    } else if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const element of clause.namedBindings.elements) {
        if (element.isTypeOnly) continue;
        const importedName = (element.propertyName ?? element.name).text;
        if (importedName === "Router") {
          expressFactories.push({ localName: element.name.text, kind: "router", source: "import" });
        }
      }
    }
  }

  if (!CHILD_PROCESS_MODULES.has(specifier)) return;

  if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
    commandSinks.push({
      binding: { kind: "namespace", localName: clause.namedBindings.name.text },
      source: "import"
    });
    return;
  }

  if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
    for (const element of clause.namedBindings.elements) {
      if (element.isTypeOnly) continue;
      const importedName = (element.propertyName ?? element.name).text;
      if (!COMMAND_METHODS.has(importedName as CommandSinkMethod)) continue;
      commandSinks.push({
        binding: {
          kind: "direct",
          localName: element.name.text,
          method: importedName as CommandSinkMethod
        },
        source: "import"
      });
    }
  }
}

function collectCommonJsCandidates(
  node: ts.VariableDeclaration,
  expressFactories: ExpressFactoryCandidate[],
  commandSinks: CommandSinkCandidate[]
): void {
  if (!isTopLevelConstDeclaration(node) || !ts.isIdentifier(node.name)) return;
  const specifier = requireSpecifier(node.initializer);
  if (!specifier) return;

  if (specifier === EXPRESS_MODULE) {
    expressFactories.push({ localName: node.name.text, kind: "app", source: "require" });
  }

  if (CHILD_PROCESS_MODULES.has(specifier)) {
    commandSinks.push({
      binding: { kind: "namespace", localName: node.name.text },
      source: "require"
    });
  }
}

function collectExpressInstanceCandidate(node: ts.VariableDeclaration): ExpressInstanceCandidate | null {
  if (!isTopLevelConstDeclaration(node) || !ts.isIdentifier(node.name) || !node.initializer) return null;
  if (!ts.isCallExpression(node.initializer)) return null;

  const callee = node.initializer.expression;
  if (ts.isIdentifier(callee)) {
    return {
      localName: node.name.text,
      factoryName: callee.text,
      factoryKind: "call"
    };
  }

  if (
    ts.isPropertyAccessExpression(callee) &&
    callee.name.text === "Router" &&
    ts.isIdentifier(callee.expression)
  ) {
    return {
      localName: node.name.text,
      factoryName: callee.expression.text,
      factoryKind: "router-property"
    };
  }

  return null;
}

function collectRouteCandidate(node: ts.CallExpression): RouteCandidate | null {
  if (!ts.isPropertyAccessExpression(node.expression)) return null;
  if (!ROUTE_METHODS.has(node.expression.name.text)) return null;
  if (!ts.isIdentifier(node.expression.expression)) return null;

  const callbacks = node.arguments.filter(
    (argument): argument is ts.ArrowFunction | ts.FunctionExpression =>
      ts.isArrowFunction(argument) || ts.isFunctionExpression(argument)
  );
  if (callbacks.length === 0) return null;

  return {
    receiverName: node.expression.expression.text,
    method: node.expression.name.text,
    callbacks
  };
}

function uniqueRuntimeBinding(counts: ReadonlyMap<string, number>, name: string): boolean {
  return (counts.get(name) ?? 0) === 1;
}

function failClosed(): TaintBindingResult {
  return { routeHandlers: [], commandSinks: [], exceeded: true };
}

export function collectTaintBindings(sourceFile: ts.SourceFile, budget: TaintBudget): TaintBindingResult {
  const declaredBindings = new Map<string, number>();
  const expressFactoryCandidates: ExpressFactoryCandidate[] = [];
  const commandSinkCandidates: CommandSinkCandidate[] = [];
  const expressInstanceCandidates: ExpressInstanceCandidate[] = [];
  const routeCandidates: RouteCandidate[] = [];

  const stack: ts.Node[] = [sourceFile];
  while (stack.length > 0) {
    if (!chargeTaintBudget(budget)) return failClosed();
    const node = stack.pop() as ts.Node;

    recordRuntimeDeclaration(node, declaredBindings);
    if (ts.isImportDeclaration(node)) {
      collectImportCandidates(node, expressFactoryCandidates, commandSinkCandidates);
    } else if (ts.isVariableDeclaration(node)) {
      collectCommonJsCandidates(node, expressFactoryCandidates, commandSinkCandidates);
      const instance = collectExpressInstanceCandidate(node);
      if (instance) expressInstanceCandidates.push(instance);
    } else if (ts.isCallExpression(node)) {
      const route = collectRouteCandidate(node);
      if (route) routeCandidates.push(route);
    }

    const children: ts.Node[] = [];
    ts.forEachChild(node, (child) => children.push(child));
    for (let index = children.length - 1; index >= 0; index -= 1) {
      stack.push(children[index] as ts.Node);
    }
  }

  const requireIsUnshadowed = (declaredBindings.get("require") ?? 0) === 0;
  const trustedFactories = new Map<string, ExpressFactoryKind>();

  for (const candidate of expressFactoryCandidates) {
    if (!chargeTaintBudget(budget)) return failClosed();
    if (!uniqueRuntimeBinding(declaredBindings, candidate.localName)) continue;
    if (candidate.source === "require" && !requireIsUnshadowed) continue;
    trustedFactories.set(candidate.localName, candidate.kind);
  }

  const trustedInstances = new Set<string>();
  for (const candidate of expressInstanceCandidates) {
    if (!chargeTaintBudget(budget)) return failClosed();
    if (!uniqueRuntimeBinding(declaredBindings, candidate.localName)) continue;

    const factoryKind = trustedFactories.get(candidate.factoryName);
    if (!factoryKind) continue;

    const trusted =
      candidate.factoryKind === "call"
        ? factoryKind === "app" || factoryKind === "router"
        : factoryKind === "app" || factoryKind === "namespace";
    if (trusted) trustedInstances.add(candidate.localName);
  }

  const commandSinks: CommandSinkBinding[] = [];
  for (const candidate of commandSinkCandidates) {
    if (!chargeTaintBudget(budget)) return failClosed();
    if (!uniqueRuntimeBinding(declaredBindings, candidate.binding.localName)) continue;
    if (candidate.source === "require" && !requireIsUnshadowed) continue;
    commandSinks.push(candidate.binding);
  }

  const routeHandlers: ExpressRouteHandler[] = [];
  for (const route of routeCandidates) {
    if (!chargeTaintBudget(budget)) return failClosed();
    if (!trustedInstances.has(route.receiverName)) continue;

    for (const callback of route.callbacks) {
      if (!chargeTaintBudget(budget)) return failClosed();
      const requestParameter = callback.parameters[0];
      if (!requestParameter || !ts.isIdentifier(requestParameter.name)) continue;
      routeHandlers.push({
        callback,
        requestName: requestParameter.name.text,
        routeMethod: route.method
      });
    }
  }

  return { routeHandlers, commandSinks, exceeded: false };
}
