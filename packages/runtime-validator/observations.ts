import type { RuntimeNetworkResponse } from "@/packages/runtime-network";
import type { CorsPolicyObservation } from "./contracts";

const MAX_CORS_HEADER_VALUE_LENGTH = 2_048;

function firstHeaderValue(
  headers: RuntimeNetworkResponse["headers"],
  name: string,
): string | null {
  const value = headers[name.toLowerCase()];
  const first = Array.isArray(value) ? value[0] : value;
  if (typeof first !== "string") return null;
  const normalized = first.trim().slice(0, MAX_CORS_HEADER_VALUE_LENGTH);
  return normalized.length > 0 ? normalized : null;
}

function redactObservationUrl(input: URL): string {
  const redacted = new URL(input.toString());
  redacted.username = "";
  redacted.password = "";
  redacted.search = "";
  redacted.hash = "";
  return redacted.toString();
}

function variesOnOrigin(value: string | null): boolean {
  if (!value) return false;
  return value
    .split(",")
    .map((token) => token.trim().toLowerCase())
    .includes("origin");
}

export function buildCorsPolicyObservation(input: {
  url: URL;
  response: RuntimeNetworkResponse;
}): CorsPolicyObservation {
  const allowedOrigin = firstHeaderValue(
    input.response.headers,
    "access-control-allow-origin",
  );
  const allowCredentials = firstHeaderValue(
    input.response.headers,
    "access-control-allow-credentials",
  );
  const vary = firstHeaderValue(input.response.headers, "vary");

  return Object.freeze({
    kind: "cors-policy" as const,
    url: redactObservationUrl(input.url),
    status: input.response.status,
    allowedOrigin,
    credentialsAllowed: allowCredentials?.toLowerCase() === "true",
    variesOnOrigin: variesOnOrigin(vary),
  });
}
