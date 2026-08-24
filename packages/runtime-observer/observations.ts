import type { RuntimeNetworkResponse } from "@/packages/runtime-network";
import {
  getHeaderValues,
  normalizeSelectedHeaderObservations,
  parseSetCookieObservation,
} from "./redaction";

export type RuntimeObservation =
  | { kind: "http-status"; url: string; status: number }
  | {
      kind: "redirect";
      from: string;
      toHost: string;
      followed: boolean;
      reason?: string;
    }
  | { kind: "header"; name: string; present: boolean; value?: string }
  | {
      kind: "cookie";
      name: string;
      secure: boolean;
      httpOnly: boolean;
      sameSite: string | null;
    }
  | {
      kind: "tls";
      protocol: string | null;
      validFrom: string | null;
      validTo: string | null;
      sanCount: number;
      hostnameMatches: boolean | null;
    };

export function redactRuntimeObservationUrl(input: URL): string {
  const redacted = new URL(input.toString());
  redacted.username = "";
  redacted.password = "";
  redacted.search = "";
  redacted.hash = "";
  return redacted.toString();
}

function normalizeDnsSan(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed.toLowerCase().startsWith("dns:")) return null;
  return trimmed.slice(4).trim().toLowerCase();
}

function parseDnsSans(subjectAltName: string | null): readonly string[] {
  if (!subjectAltName) return Object.freeze([]);
  return Object.freeze(
    subjectAltName
      .split(",")
      .map(normalizeDnsSan)
      .filter((value): value is string => value !== null && value.length > 0),
  );
}

function hostnameMatchesSan(hostname: string, san: string): boolean {
  const normalizedHostname = hostname.toLowerCase();
  if (san === normalizedHostname) return true;
  if (!san.startsWith("*.")) return false;

  const suffix = san.slice(2);
  if (!normalizedHostname.endsWith(`.${suffix}`)) return false;
  const prefix = normalizedHostname.slice(0, -(suffix.length + 1));
  return prefix.length > 0 && !prefix.includes(".");
}

export function buildPassiveResponseObservations(input: {
  url: URL;
  response: RuntimeNetworkResponse;
}): readonly RuntimeObservation[] {
  const observations: RuntimeObservation[] = [
    Object.freeze({
      kind: "http-status" as const,
      url: redactRuntimeObservationUrl(input.url),
      status: input.response.status,
    }),
    ...normalizeSelectedHeaderObservations(input.response.headers),
  ];

  for (const cookie of getHeaderValues(input.response.headers, "set-cookie")) {
    observations.push(parseSetCookieObservation(cookie));
  }

  const sans = parseDnsSans(input.response.tls.subjectAltName);
  observations.push(
    Object.freeze({
      kind: "tls" as const,
      protocol: input.response.tls.protocol,
      validFrom: input.response.tls.validFrom,
      validTo: input.response.tls.validTo,
      sanCount: sans.length,
      hostnameMatches:
        sans.length === 0
          ? null
          : sans.some((san) => hostnameMatchesSan(input.url.hostname, san)),
    }),
  );

  return Object.freeze(observations);
}
