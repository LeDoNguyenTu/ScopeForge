import type { ScannerRuleSelection } from "../../scanner-core/config/types";
import { compareFindings } from "../../scanner-core/findings/severity";
import type { Finding } from "../../scanner-core/findings/types";
import { createIacFinding } from "../findings/create-finding";
import { IAC_RULES } from "../rules/builtin";
import type { IacRuleDefinition } from "../rules/types";
import { parseDockerfile } from "./parse";
import type { DockerInstruction, DockerScanResult, ScanDockerfileInput } from "./types";

const rulesById = new Map(IAC_RULES.map((rule) => [rule.id, rule]));

function ruleEnabled(ruleId: string, selection: ScannerRuleSelection | undefined): boolean {
  if (!selection) return true;
  if (selection.exclude.includes(ruleId)) return false;
  return selection.include.length === 0 || selection.include.includes(ruleId);
}

function shellWords(value: string): string[] {
  const words: string[] = [];
  let current = "";
  let quote: "'" | '"' | null = null;
  let escaped = false;

  for (const character of value) {
    if (escaped) {
      current += character;
      escaped = false;
      continue;
    }
    if (character === "\\" && quote !== "'") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (character === quote) quote = null;
      else current += character;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      continue;
    }
    if (/\s/.test(character)) {
      if (current) {
        words.push(current);
        current = "";
      }
      continue;
    }
    current += character;
  }
  if (current) words.push(current);
  return words;
}

function maskQuotedText(value: string): string {
  let quote: "'" | '"' | null = null;
  let escaped = false;
  let output = "";

  for (const character of value) {
    if (escaped) {
      output += quote ? " " : character;
      escaped = false;
      continue;
    }
    if (character === "\\" && quote !== "'") {
      output += quote ? " " : character;
      escaped = true;
      continue;
    }
    if (quote) {
      if (character === quote) quote = null;
      output += " ";
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      output += " ";
      continue;
    }
    output += character;
  }

  return output;
}

function fromImage(value: string): string | null {
  const words = shellWords(value);
  for (const word of words) {
    if (word.startsWith("--")) continue;
    return word;
  }
  return null;
}

function isFloatingImage(image: string): boolean {
  const normalized = image.trim();
  if (!normalized || normalized.includes("$")) return false;
  if (normalized.toLowerCase() === "scratch") return false;
  if (normalized.includes("@")) return false;

  const lastSlash = normalized.lastIndexOf("/");
  const lastColon = normalized.lastIndexOf(":");
  if (lastColon <= lastSlash) return true;
  return normalized.slice(lastColon + 1).toLowerCase() === "latest";
}

function isExplicitRoot(value: string): boolean {
  const user = shellWords(value)[0]?.toLowerCase();
  if (!user || user.includes("$")) return false;
  return /^(?:root|0)(?::[^\s]+)?$/.test(user);
}

function addSources(value: string): string[] {
  const trimmed = value.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === "string")) return [];
      return parsed.slice(0, -1) as string[];
    } catch {
      return [];
    }
  }

  const words = shellWords(value).filter((word) => !word.startsWith("--"));
  return words.length > 1 ? words.slice(0, -1) : [];
}

function isRemoteSource(value: string): boolean {
  const normalized = value.toLowerCase();
  return (
    normalized.startsWith("http://") ||
    normalized.startsWith("https://") ||
    normalized.startsWith("git://") ||
    normalized.startsWith("ssh://") ||
    /^git@[^:]+:.+/.test(value)
  );
}

function hasDownloadPipeShell(value: string): boolean {
  const command = maskQuotedText(value);
  return /(?:^|(?:&&|\|\||;|\|)\s*)(?:curl|wget)\b[^|;&]*\|\s*(?:\/bin\/)?(?:sh|bash)\b/i.test(command);
}

function hasWorldWritableChmod(value: string): boolean {
  const command = maskQuotedText(value);
  return /(?:^|(?:&&|\|\||;)\s*)chmod\s+(?:-[A-Za-z]+\s+)*0?777(?:\s|$)/i.test(command);
}

interface FindingDescriptor {
  ruleId: string;
  instruction: DockerInstruction;
  structuralContext: string;
  evidenceSummary: string;
}

function makeFinding(
  file: string,
  descriptor: FindingDescriptor,
  occurrence: number
): Finding | null {
  const rule = rulesById.get(descriptor.ruleId) as IacRuleDefinition | undefined;
  if (!rule) return null;
  return createIacFinding({
    rule,
    file,
    instruction: descriptor.instruction,
    structuralContext: descriptor.structuralContext,
    occurrence,
    evidenceSummary: descriptor.evidenceSummary
  });
}

export function scanDockerfile(input: ScanDockerfileInput): DockerScanResult {
  const parsed = parseDockerfile(
    { file: input.file, content: input.content },
    input.parser ?? {}
  );
  if (parsed.errors.length > 0) return { findings: [], errors: parsed.errors };

  const descriptors: FindingDescriptor[] = [];
  let finalStageSeen = false;
  let finalStageUser: DockerInstruction | null = null;

  for (const instruction of parsed.instructions) {
    if (instruction.keyword === "FROM") {
      finalStageSeen = true;
      finalStageUser = null;
      const image = fromImage(instruction.value);
      if (
        image &&
        isFloatingImage(image) &&
        ruleEnabled("iac/docker-floating-base-image", input.rules)
      ) {
        descriptors.push({
          ruleId: "iac/docker-floating-base-image",
          instruction,
          structuralContext: "Docker FROM base-image reference",
          evidenceSummary: "Observed a static Docker base image reference that is untagged or uses the latest tag."
        });
      }
      continue;
    }

    if (instruction.keyword === "USER" && finalStageSeen) {
      finalStageUser = instruction;
      continue;
    }

    if (
      instruction.keyword === "ADD" &&
      ruleEnabled("iac/docker-remote-add", input.rules) &&
      addSources(instruction.value).some(isRemoteSource)
    ) {
      descriptors.push({
        ruleId: "iac/docker-remote-add",
        instruction,
        structuralContext: "Docker ADD remote source",
        evidenceSummary: "Observed a Docker ADD instruction that consumes a remote source."
      });
    }

    if (instruction.keyword === "RUN") {
      if (
        ruleEnabled("iac/docker-download-pipe-shell", input.rules) &&
        hasDownloadPipeShell(instruction.value)
      ) {
        descriptors.push({
          ruleId: "iac/docker-download-pipe-shell",
          instruction,
          structuralContext: "Docker RUN download-to-shell pipeline",
          evidenceSummary: "Observed a Docker RUN command that pipes downloader output directly to a shell."
        });
      }
      if (
        ruleEnabled("iac/docker-world-writable-permissions", input.rules) &&
        hasWorldWritableChmod(instruction.value)
      ) {
        descriptors.push({
          ruleId: "iac/docker-world-writable-permissions",
          instruction,
          structuralContext: "Docker RUN world-writable chmod",
          evidenceSummary: "Observed a Docker RUN command that applies world-writable mode 777 or 0777."
        });
      }
    }
  }

  if (
    finalStageUser &&
    isExplicitRoot(finalStageUser.value) &&
    ruleEnabled("iac/docker-root-user", input.rules)
  ) {
    descriptors.push({
      ruleId: "iac/docker-root-user",
      instruction: finalStageUser,
      structuralContext: "Docker final-stage effective USER",
      evidenceSummary: "Observed an explicit root USER as the final effective user declaration."
    });
  }

  const occurrences = new Map<string, number>();
  const findings: Finding[] = [];
  for (const descriptor of descriptors) {
    const occurrence = (occurrences.get(descriptor.ruleId) ?? 0) + 1;
    occurrences.set(descriptor.ruleId, occurrence);
    const finding = makeFinding(input.file, descriptor, occurrence);
    if (finding) findings.push(finding);
  }

  return { findings: findings.sort(compareFindings), errors: [] };
}
