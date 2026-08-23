import ts from "typescript";

export interface WalkAstOptions {
  maxNodes: number;
}

export interface WalkAstResult {
  visitedNodes: number;
  exceeded: boolean;
}

export function walkAst(
  sourceFile: ts.SourceFile,
  visitor: (node: ts.Node) => void,
  options: WalkAstOptions
): WalkAstResult {
  const maxNodes = Math.max(0, Math.floor(options.maxNodes));
  const stack: ts.Node[] = [sourceFile];
  let visitedNodes = 0;

  while (stack.length > 0) {
    if (visitedNodes >= maxNodes) {
      return { visitedNodes, exceeded: true };
    }

    const node = stack.pop() as ts.Node;
    visitor(node);
    visitedNodes += 1;

    const children: ts.Node[] = [];
    ts.forEachChild(node, (child) => {
      children.push(child);
    });
    for (let index = children.length - 1; index >= 0; index -= 1) {
      stack.push(children[index] as ts.Node);
    }
  }

  return { visitedNodes, exceeded: false };
}
