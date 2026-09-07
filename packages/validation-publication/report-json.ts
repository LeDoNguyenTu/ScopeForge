import type { NormalizedPublicationV1 } from "./contracts";

export function serializeTechnicalPublicationJson(result: NormalizedPublicationV1): string {
  return `${JSON.stringify(result, null, 2)}\n`;
}
