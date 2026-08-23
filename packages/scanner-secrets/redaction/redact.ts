export interface RedactDetectedSecretInput {
  value: string;
  provider: string;
  publicPrefix?: string;
}

export interface RedactedSecretEvidence {
  display: string;
  length: number;
  provider: string;
}

function safePublicPrefix(prefix: string | undefined): string {
  if (!prefix) return "";
  return prefix.replace(/[^A-Za-z0-9_\- ]/g, (character) =>
    character === "-" ? "-" : character === "_" ? "_" : ""
  ).slice(0, 64);
}

export function redactDetectedSecret(input: RedactDetectedSecretInput): RedactedSecretEvidence {
  const prefix = input.provider === "private-key"
    ? (input.publicPrefix?.match(/BEGIN [A-Z0-9 ]*PRIVATE KEY/)?.[0] ?? "PRIVATE KEY")
    : safePublicPrefix(input.publicPrefix);

  return {
    display: prefix ? `${prefix} [REDACTED]` : "[REDACTED]",
    length: input.value.length,
    provider: input.provider
  };
}
