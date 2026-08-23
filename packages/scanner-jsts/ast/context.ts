import ts from "typescript";

const MAX_CONTEXT_LENGTH = 96;

function declarationName(name: ts.DeclarationName | undefined): string | null {
  if (!name) return null;
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  return null;
}

function bounded(prefix: string, name: string): string {
  const sanitized = name.replace(/[^A-Za-z0-9_$.-]/g, "_").slice(0, 80) || "anonymous";
  return `${prefix}:${sanitized}`.slice(0, MAX_CONTEXT_LENGTH);
}

function variableAssignedFunctionName(node: ts.FunctionExpression | ts.ArrowFunction): string | null {
  const parent = node.parent;
  if (parent && ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
    return parent.name.text;
  }
  return null;
}

export function structuralContext(node: ts.Node): string {
  let current: ts.Node | undefined = node;

  while (current) {
    if (ts.isMethodDeclaration(current)) {
      const name = declarationName(current.name);
      if (name) return bounded("method", name);
    }

    if (ts.isFunctionDeclaration(current)) {
      if (current.name) return bounded("function", current.name.text);
    }

    if (ts.isFunctionExpression(current)) {
      if (current.name) return bounded("function", current.name.text);
      const assigned = variableAssignedFunctionName(current);
      if (assigned) return bounded("function", assigned);
    }

    if (ts.isArrowFunction(current)) {
      const assigned = variableAssignedFunctionName(current);
      if (assigned) return bounded("function", assigned);
    }

    if (ts.isClassDeclaration(current) || ts.isClassExpression(current)) {
      const name = current.name?.text;
      if (name) return bounded("class", name);
    }

    current = current.parent;
  }

  return "module";
}
