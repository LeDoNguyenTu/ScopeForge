import { executeNucleiRunner } from "./runner";
import { parseNucleiContainerInput } from "./input";

function safeCode(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  return /^[A-Z][A-Z0-9_:.-]{0,127}$/.test(message) ? message : "NUCLEI_CONTAINER_FAILED";
}

async function main(): Promise<void> {
  try {
    const input = parseNucleiContainerInput(process.argv.slice(2));
    const result = await executeNucleiRunner(input, new AbortController().signal);
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ code: safeCode(error) })}\n`);
    process.exitCode = 1;
  }
}

void main();
