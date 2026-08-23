import type { Finding } from "../scanner-core/findings/types";
import { shannonEntropy } from "./entropy/shannon";
import { createSecretFingerprint } from "./findings/fingerprint";
import { redactDetectedSecret } from "./redaction/redact";
import { SECRET_RULES } from "./rules/builtin";
import type { SecretRuleDefinition, SecretRuleSelection } from "./rules/types";

export interface ScanSecretTextInput {
  file: string;
  content: string;
  options?: SecretRuleSelection;
}

const INLINE_ALLOW_ANNOTATION = /(?:\/\/|#)\s*scopeforge:allow-secret(?:\s|$)/;
const STANDALONE_ALLOW_ANNOTATION = /^\s*(?:\/\/|#)\s*scopeforge:allow-secret\s*$/;
const ENTROPY_ASSIGNMENT = /\b([A-Za-z_][A-Za-z0-9_]*)\s*[:=]\s*["']([^"'\r\n]{20,128})["']/g;
const SECRET_KEY_TERMS = ["token", "secret", "password", "apikey", "credential", "privatekey"];
const PLACEHOLDER_TERMS = [
  "example",
  "sample",
  "dummy",
  "placeholder",
  "changeme",
  "not-a-real",
  "not_a_real",
  "synthetic_test",
  "test_fixture"
];

function enabledRules(selection: SecretRuleSelection | undefined): SecretRuleDefinition[] {
  const include = new Set(selection?.include ?? []);
  const exclude = new Set(selection?.exclude ?? []);
  return SECRET_RULES.filter((rule) => (include.size === 0 || include.has(rule.id)) && !exclude.has(rule.id));
}

function hasInlineAllowAnnotation(line: string | undefined): boolean {
  return line !== undefined && INLINE_ALLOW_ANNOTATION.test(line);
}

function hasStandaloneAllowAnnotation(line: string | undefined): boolean {
  return line !== undefined && STANDALONE_ALLOW_ANNOTATION.test(line);
}

function isObviousPlaceholder(value: string): boolean {
  const lower = value.toLowerCase();
  if (PLACEHOLDER_TERMS.some((term) => lower.includes(term))) return true;

  const body = value.replace(/^(?:ghp_|github_pat_|sk_live_|xox[baprs]-)/i, "");
  const compact = body.replace(/[^A-Za-z0-9]/g, "");
  if (compact.length >= 12 && new Set(compact.toLowerCase()).size <= 3) return true;
  return /^(.)\1{11,}$/.test(compact);
}

function safeStructuralContext(line: string, matchStart: number, fallback: string): string {
  const before = line.slice(0, matchStart).slice(-96);
  const assignment = before.match(/([A-Za-z_][A-Za-z0-9_.-]{0,63})\s*[:=]\s*["']?\s*$/);
  return assignment?.[1] ? `assignment:${assignment[1].toLowerCase()}` : fallback;
}

function providerPrefix(rule: SecretRuleDefinition, value: string): string | undefined {
  if (rule.provider === "github") return value.startsWith("github_pat_") ? "github_pat_" : "ghp_";
  if (rule.provider === "slack") return value.slice(0, 5);
  return rule.publicPrefix;
}

function makeFinding(input: {
  rule: SecretRuleDefinition;
  file: string;
  lineIndex: number;
  startIndex: number;
  secret: string;
  structuralContext: string;
  publicPrefix?: string;
}): Finding {
  const redacted = redactDetectedSecret({
    value: input.secret,
    provider: input.rule.provider,
    publicPrefix: input.publicPrefix
  });
  const fingerprint = createSecretFingerprint({
    ruleId: input.rule.id,
    file: input.file,
    structuralContext: input.structuralContext,
    secret: input.secret
  });

  return {
    id: fingerprint,
    fingerprint,
    scanner: "secrets",
    ruleId: input.rule.id,
    ruleVersion: input.rule.version,
    title: input.rule.title,
    description: input.rule.description,
    severity: input.rule.severity,
    confidence: input.rule.confidence,
    category: "secrets",
    validation: input.rule.provider === "entropy" ? "heuristic" : "static_confirmed",
    provenance: "observed",
    location: {
      file: input.file,
      startLine: input.lineIndex + 1,
      startColumn: input.startIndex + 1,
      endLine: input.lineIndex + 1,
      endColumn: input.startIndex + input.secret.length + 1
    },
    evidence: {
      summary: `Detected by ${input.rule.id}.`,
      redactedSnippet: `${input.structuralContext}: ${redacted.display}`
    },
    cwe: ["CWE-798"],
    owasp: ["A07:2021"],
    references: [],
    remediation: {
      summary: "Remove the exposed credential from source control.",
      guidance: "Revoke or rotate the credential, remove it from repository history where appropriate, and load the replacement from an approved secret store or environment boundary.",
      verification: "Rescan the repository and confirm the finding fingerprint no longer appears."
    },
    metadata: {
      provider: redacted.provider,
      secretLength: redacted.length
    },
    baselineState: "new"
  };
}

function matchesProviderSecret(value: string): boolean {
  return SECRET_RULES.some((rule) => {
    if (!rule.pattern || rule.provider === "private-key") return false;
    const matcher = new RegExp(rule.pattern.source, rule.pattern.flags);
    const match = matcher.exec(value);
    return match?.[0] === value;
  });
}

function privateKeyMaterial(lines: string[], headerIndex: number): string {
  const end = Math.min(lines.length, headerIndex + 4096);
  const collected: string[] = [];
  for (let index = headerIndex; index < end; index += 1) {
    const line = lines[index] ?? "";
    collected.push(line);
    if (/-----END (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/.test(line)) break;
  }
  return collected.join("\n");
}

export function scanSecretText(input: ScanSecretTextInput): Finding[] {
  const lines = input.content.split(/\r?\n/);
  const rules = enabledRules(input.options);
  const findings: Finding[] = [];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex] ?? "";
    const suppressed = hasInlineAllowAnnotation(line) || hasStandaloneAllowAnnotation(lines[lineIndex - 1]);
    if (suppressed) continue;

    for (const rule of rules) {
      if (!rule.pattern || rule.provider === "entropy") continue;
      const matcher = new RegExp(rule.pattern.source, `${rule.pattern.flags.replace("g", "")}g`);
      for (const match of line.matchAll(matcher)) {
        const value = match[0];
        const startIndex = match.index ?? 0;
        if (isObviousPlaceholder(value)) continue;

        if (rule.provider === "private-key") {
          const material = privateKeyMaterial(lines, lineIndex);
          findings.push(makeFinding({
            rule,
            file: input.file,
            lineIndex,
            startIndex,
            secret: material,
            structuralContext: "private-key-header",
            publicPrefix: value
          }));
          continue;
        }

        findings.push(makeFinding({
          rule,
          file: input.file,
          lineIndex,
          startIndex,
          secret: value,
          structuralContext: safeStructuralContext(line, startIndex, `provider:${rule.provider}`),
          publicPrefix: providerPrefix(rule, value)
        }));
      }
    }

    const entropyRule = rules.find((rule) => rule.id === "secrets/high-entropy-assignment");
    if (!entropyRule) continue;

    const matcher = new RegExp(ENTROPY_ASSIGNMENT.source, "g");
    for (const match of line.matchAll(matcher)) {
      const key = match[1] ?? "";
      const value = match[2] ?? "";
      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (!SECRET_KEY_TERMS.some((term) => normalizedKey.includes(term))) continue;
      if (isObviousPlaceholder(value) || matchesProviderSecret(value)) continue;
      if (shannonEntropy(value) < 3.5) continue;

      const quotedStart = line.indexOf(value, match.index ?? 0);
      findings.push(makeFinding({
        rule: entropyRule,
        file: input.file,
        lineIndex,
        startIndex: quotedStart >= 0 ? quotedStart : (match.index ?? 0),
        secret: value,
        structuralContext: `assignment:${normalizedKey}`
      }));
    }
  }

  return findings;
}
