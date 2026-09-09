import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const DYNAMIC_CODE_RULE = "jsts/dynamic-code-execution";
const SOURCE_FILES_PER_LANGUAGE = 600;
const FUNCTIONS_PER_FILE = 8;

async function write(root, relativePath, content) {
  const destination = join(root, relativePath);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, content, "utf8");
}

function functionBody(fileIndex, functionIndex) {
  const fileSuffix = String(fileIndex).padStart(3, "0");
  return [
    `export function transform${fileSuffix}_${functionIndex}(input) {`,
    "  const values = [0, 1, 2, 3, 4, 5, 6, 7];",
    "  const mapped = values.map((value) => ({ value, doubled: value * 2, input }));",
    "  const filtered = mapped.filter((item) => item.doubled % 3 !== 0);",
    "  return filtered.reduce((total, item) => total + item.doubled, 0);",
    "}",
  ].join("\n");
}

function sourceFile(fileIndex, language) {
  const functions = [];
  for (let functionIndex = 0; functionIndex < FUNCTIONS_PER_FILE; functionIndex += 1) {
    functions.push(functionBody(fileIndex, functionIndex));
  }

  if (fileIndex === 0 && language === "ts") {
    functions.push('eval("1 + 1");');
  } else if (fileIndex === 1 && language === "ts") {
    functions.push('eval("2 + 2");');
  } else if (fileIndex === 0 && language === "js") {
    functions.push('const generatedOne = new Function("return 1"); generatedOne();');
  } else if (fileIndex === 1 && language === "js") {
    functions.push('const generatedTwo = new Function("return 2"); generatedTwo();');
  }

  return `${functions.join("\n\n")}\n`;
}

export async function buildSourceAstHeavyFixture(root) {
  for (let index = 0; index < SOURCE_FILES_PER_LANGUAGE; index += 1) {
    const suffix = String(index).padStart(3, "0");
    await write(root, `src/ts/module-${suffix}.ts`, sourceFile(index, "ts"));
    await write(root, `src/js/module-${suffix}.js`, sourceFile(index, "js"));
  }

  await write(
    root,
    ".scopeforge.json",
    `${JSON.stringify(
      {
        version: 1,
        scanners: ["jsts"],
        rules: { include: [DYNAMIC_CODE_RULE] },
      },
      null,
      2,
    )}\n`,
  );
}

export const SOURCE_AST_HEAVY_PROFILE = Object.freeze({
  id: "source-ast-heavy-v1",
  expectedFiles: 1201,
  expectedFindingRuleCounts: Object.freeze({ [DYNAMIC_CODE_RULE]: 4 }),
  maxWallMs: 30_000,
  buildFixture: buildSourceAstHeavyFixture,
  async preflight() {},
});
