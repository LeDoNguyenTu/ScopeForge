import type { RuntimeObservation } from "./observations";

const MAX_HEADER_VALUE_LENGTH = 1_024;
const MAX_COOKIE_NAME_LENGTH = 128;

const SELECTED_HEADERS = Object.freeze([
  "content-type",
  "strict-transport-security",
  "content-security-policy",
  "x-content-type-options",
  "referrer-policy",
  "permissions-policy",
  "server",
] as const);

type HeaderValue = string | readonly string[] | undefined;
type HeaderRecord = Readonly<Record<string, HeaderValue>>;

function boundString(value: string, maximum: number): string {
  return value.length <= maximum ? value : value.slice(0, maximum);
}

function findHeader(headers: HeaderRecord, wanted: string): HeaderValue {
  const direct = headers[wanted];
  if (direct !== undefined) return direct;

  const entry = Object.entries(headers).find(([name]) => name.toLowerCase() === wanted);
  return entry?.[1];
}

function normalizeHeaderValue(value: Exclude<HeaderValue, undefined>): string {
  const joined = typeof value === "string" ? value : value.join(", ");
  return boundString(joined, MAX_HEADER_VALUE_LENGTH);
}

function normalizeSameSite(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (normalized === "lax") return "Lax";
  if (normalized === "strict") return "Strict";
  if (normalized === "none") return "None";
  return boundString(value.trim(), 32);
}

export function parseSetCookieObservation(value: string): Extract<RuntimeObservation, { kind: "cookie" }> {
  const segments = value.split(";");
  const nameValue = segments.shift() ?? "";
  const separator = nameValue.indexOf("=");
  const rawName = separator >= 0 ? nameValue.slice(0, separator) : nameValue;
  const name = boundString(rawName.trim(), MAX_COOKIE_NAME_LENGTH);

  let secure = false;
  let httpOnly = false;
  let sameSite: string | null = null;

  for (const segment of segments) {
    const attribute = segment.trim();
    const lower = attribute.toLowerCase();
    if (lower === "secure") {
      secure = true;
      continue;
    }
    if (lower === "httponly") {
      httpOnly = true;
      continue;
    }
    if (lower.startsWith("samesite=")) {
      sameSite = normalizeSameSite(attribute.slice(attribute.indexOf("=") + 1));
    }
  }

  return Object.freeze({
    kind: "cookie" as const,
    name,
    secure,
    httpOnly,
    sameSite,
  });
}

export function normalizeSelectedHeaderObservations(
  headers: HeaderRecord,
): readonly Extract<RuntimeObservation, { kind: "header" }>[] {
  return Object.freeze(
    SELECTED_HEADERS.map((name) => {
      const value = findHeader(headers, name);
      if (value === undefined) {
        return Object.freeze({ kind: "header" as const, name, present: false as const });
      }

      return Object.freeze({
        kind: "header" as const,
        name,
        present: true as const,
        value: normalizeHeaderValue(value),
      });
    }),
  );
}

export function getHeaderValues(headers: HeaderRecord, name: string): readonly string[] {
  const value = findHeader(headers, name.toLowerCase());
  if (value === undefined) return Object.freeze([]);
  return Object.freeze(typeof value === "string" ? [value] : [...value]);
}
