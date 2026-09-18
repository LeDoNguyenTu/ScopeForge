import { createHash } from "node:crypto";

const PREFIX_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

export function phase11StableId(
  prefix: string,
  parts: readonly (string | readonly string[])[],
): string {
  if (!PREFIX_PATTERN.test(prefix)) {
    throw new Error("PHASE11_IDENTIFIER_PREFIX_INVALID");
  }
  const canonical = JSON.stringify(parts);
  if (canonical === undefined) {
    throw new Error("PHASE11_IDENTIFIER_INPUT_INVALID");
  }
  const digest = createHash("sha256").update(canonical, "utf8").digest("hex");
  return `${prefix}:${digest}`;
}
