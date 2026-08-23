import type { SecretRuleDefinition } from "./types";

export const SECRET_RULES: readonly SecretRuleDefinition[] = [
  {
    id: "secrets/github-token",
    version: "1.0.0",
    title: "GitHub token exposed",
    description: "A GitHub credential with a provider-specific token format is present in repository content.",
    severity: "high",
    confidence: "high",
    provider: "github",
    pattern: /\b(?:ghp_[A-Za-z0-9]{36,255}|github_pat_[A-Za-z0-9_]{20,255})\b/,
    publicPrefix: "ghp_"
  },
  {
    id: "secrets/stripe-live-key",
    version: "1.0.0",
    title: "Stripe live secret key exposed",
    description: "A Stripe live-mode secret key is present in repository content.",
    severity: "high",
    confidence: "high",
    provider: "stripe",
    pattern: /\bsk_live_[A-Za-z0-9]{20,64}\b/,
    publicPrefix: "sk_live_"
  },
  {
    id: "secrets/slack-token",
    version: "1.0.0",
    title: "Slack token exposed",
    description: "A Slack token with a provider-specific credential format is present in repository content.",
    severity: "high",
    confidence: "high",
    provider: "slack",
    pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,200}\b/,
    publicPrefix: "xoxb-"
  },
  {
    id: "secrets/private-key",
    version: "1.0.0",
    title: "Private key exposed",
    description: "A PEM or OpenSSH private-key block is present in repository content.",
    severity: "high",
    confidence: "high",
    provider: "private-key",
    pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/
  },
  {
    id: "secrets/high-entropy-assignment",
    version: "1.0.0",
    title: "High-entropy secret assignment",
    description: "A security-relevant assignment contains a high-entropy value that resembles a secret.",
    severity: "medium",
    confidence: "medium",
    provider: "entropy"
  }
] as const;

export const SECRET_RULE_IDS = SECRET_RULES.map((rule) => rule.id);
