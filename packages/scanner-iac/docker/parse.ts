import type {
  DockerInstruction,
  DockerParseResult,
  DockerParserOptions,
  ParseDockerfileInput
} from "./types";

const DEFAULT_MAX_INSTRUCTIONS = 4_096;
const DEFAULT_MAX_INSTRUCTION_BYTES = 64 * 1024;

function positiveInteger(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

function errorResult(code: string, file: string, message: string): DockerParseResult {
  return { instructions: [], errors: [{ code, file, message }] };
}

function continuationBody(value: string, escapeCharacter: string): string | null {
  const trimmed = value.trimEnd();
  if (!trimmed.endsWith(escapeCharacter)) return null;
  return trimmed.slice(0, -escapeCharacter.length).trimEnd();
}

interface HeredocMarker {
  delimiter: string;
  stripTabs: boolean;
}

function findHeredoc(value: string): HeredocMarker | null {
  const match = value.match(/<<(-)?\s*(['"]?)([A-Za-z_][A-Za-z0-9_.-]*)\2/);
  if (!match?.[3]) return null;
  return { delimiter: match[3], stripTabs: match[1] === "-" };
}

export function parseDockerfile(
  input: ParseDockerfileInput,
  options: DockerParserOptions = {}
): DockerParseResult {
  if (input.content.includes("\0")) {
    return errorResult(
      "unsupported_binary_dockerfile",
      input.file,
      "Dockerfile contains NUL bytes and was not parsed."
    );
  }

  const maxInstructions = positiveInteger(options.maxInstructions, DEFAULT_MAX_INSTRUCTIONS);
  const maxInstructionBytes = positiveInteger(
    options.maxInstructionBytes,
    DEFAULT_MAX_INSTRUCTION_BYTES
  );
  const lines = input.content.replace(/\r\n?/g, "\n").split("\n");
  const instructions: DockerInstruction[] = [];
  let escapeCharacter = "\\";
  let sawInstruction = false;

  for (let index = 0; index < lines.length; index += 1) {
    const physical = lines[index] ?? "";
    const trimmed = physical.trim();

    if (trimmed === "") continue;
    if (trimmed.startsWith("#")) {
      if (!sawInstruction) {
        const directive = trimmed.match(/^#\s*escape\s*=\s*([\\`])\s*$/i);
        if (directive?.[1]) escapeCharacter = directive[1];
      }
      continue;
    }

    const startLine = index + 1;
    let endLine = startLine;
    let logical = physical.trim();
    let instructionBytes = Buffer.byteLength(logical, "utf8");

    while (true) {
      const body = continuationBody(logical, escapeCharacter);
      if (body === null) break;
      logical = body;
      index += 1;
      if (index >= lines.length) break;
      const next = (lines[index] ?? "").trim();
      logical = `${logical} ${next}`.trim();
      endLine = index + 1;
      instructionBytes = Buffer.byteLength(logical, "utf8");
      if (instructionBytes > maxInstructionBytes) {
        return errorResult(
          "docker_instruction_too_large",
          input.file,
          "Docker logical instruction exceeded the configured byte budget."
        );
      }
    }

    if (instructionBytes > maxInstructionBytes) {
      return errorResult(
        "docker_instruction_too_large",
        input.file,
        "Docker logical instruction exceeded the configured byte budget."
      );
    }

    const parsed = logical.match(/^([A-Za-z]+)(?:\s+(.*))?$/);
    if (!parsed?.[1]) {
      return errorResult(
        "invalid_dockerfile_instruction",
        input.file,
        "Dockerfile contains an instruction that could not be parsed safely."
      );
    }

    const keyword = parsed[1].toUpperCase();
    const value = (parsed[2] ?? "").trim();
    const heredoc = findHeredoc(value);
    if (heredoc) {
      let terminated = false;
      while (index + 1 < lines.length) {
        index += 1;
        endLine = index + 1;
        const bodyLine = lines[index] ?? "";
        instructionBytes += Buffer.byteLength(bodyLine, "utf8") + 1;
        if (instructionBytes > maxInstructionBytes) {
          return errorResult(
            "docker_instruction_too_large",
            input.file,
            "Docker logical instruction exceeded the configured byte budget."
          );
        }
        const candidate = heredoc.stripTabs ? bodyLine.replace(/^\t+/, "") : bodyLine;
        if (candidate === heredoc.delimiter) {
          terminated = true;
          break;
        }
      }
      if (!terminated) {
        return errorResult(
          "invalid_dockerfile_heredoc",
          input.file,
          "Docker heredoc terminator was not found within the input."
        );
      }
    }

    instructions.push({ keyword, value, startLine, endLine });
    sawInstruction = true;
    if (instructions.length > maxInstructions) {
      return errorResult(
        "docker_instruction_budget_exceeded",
        input.file,
        "Dockerfile exceeded the configured logical instruction budget."
      );
    }
  }

  return { instructions, errors: [] };
}
