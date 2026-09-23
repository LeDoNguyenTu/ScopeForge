import { isIP } from "node:net";
import { normalizePublicResolvedAddresses } from "../network-safety";

export type ExternalProviderKind = "httpx" | "nuclei";

export const PROVIDER_EGRESS_LOOPBACK_HOST = "127.0.0.1" as const;
export const PROVIDER_EGRESS_LOOPBACK_PORT = 17777 as const;
export const PROVIDER_EGRESS_LOOPBACK_PROXY_URL =
  `socks5://${PROVIDER_EGRESS_LOOPBACK_HOST}:${PROVIDER_EGRESS_LOOPBACK_PORT}` as const;

export const PROVIDER_EGRESS_LIMITS = Object.freeze({
  maxResolvedIpv4Addresses: 4,
  maxConnections: 8,
  maxBytesToTarget: 131_072,
  maxBytesFromTarget: 1_048_576,
  maxWallTimeMs: 10_000,
});

export interface ProviderEgressBudget {
  maxConnections: number;
  maxBytesToTarget: number;
  maxBytesFromTarget: number;
  maxWallTimeMs: number;
}

export interface ProviderEgressPolicyInput {
  provider: ExternalProviderKind;
  hostname: string;
  scheme: "http" | "https";
  port: number;
  resolvedAddresses: readonly string[];
  budget: ProviderEgressBudget;
}

export interface ProviderEgressPolicy {
  provider: ExternalProviderKind;
  hostname: string;
  scheme: "http" | "https";
  port: number;
  resolvedIpv4Addresses: readonly string[];
  budget: Readonly<ProviderEgressBudget>;
}

const HOST_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
const BLOCKED_HOST_SUFFIXES = Object.freeze([
  "localhost",
  ".localhost",
  ".local",
  ".internal",
  ".home.arpa",
]);

function fail(code: string): never {
  throw new Error(code);
}

function canonicalHostname(value: string): string {
  const hostname = value.trim().toLowerCase();
  if (!hostname || hostname.length > 253 || hostname.endsWith(".") || isIP(hostname) !== 0) {
    return fail("PROVIDER_EGRESS_HOST_INVALID");
  }
  const labels = hostname.split(".");
  if (labels.some((label) => !HOST_LABEL.test(label))) {
    return fail("PROVIDER_EGRESS_HOST_INVALID");
  }
  if (BLOCKED_HOST_SUFFIXES.some((suffix) => hostname === suffix || hostname.endsWith(suffix))) {
    return fail("PROVIDER_EGRESS_HOST_BLOCKED");
  }
  return hostname;
}

export function isPublicProviderIpv4(value: string): boolean {
  try {
    const normalized = normalizePublicResolvedAddresses([value]);
    return normalized.length === 1 && normalized[0]?.family === 4;
  } catch {
    return false;
  }
}

function positiveBoundedInteger(value: number, maximum: number, code: string): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) return fail(code);
  return value;
}

export function createProviderEgressPolicy(
  input: ProviderEgressPolicyInput,
): Readonly<ProviderEgressPolicy> {
  if (input.provider !== "httpx" && input.provider !== "nuclei") {
    return fail("PROVIDER_EGRESS_PROVIDER_INVALID");
  }
  if (input.scheme !== "http" && input.scheme !== "https") {
    return fail("PROVIDER_EGRESS_SCHEME_INVALID");
  }
  if (!Number.isInteger(input.port) || input.port < 1 || input.port > 65535) {
    return fail("PROVIDER_EGRESS_PORT_INVALID");
  }

  const hostname = canonicalHostname(input.hostname);
  let normalizedAddresses: ReturnType<typeof normalizePublicResolvedAddresses>;
  try {
    normalizedAddresses = normalizePublicResolvedAddresses(input.resolvedAddresses);
  } catch {
    return fail("PROVIDER_EGRESS_ADDRESS_SET_INVALID");
  }
  if (normalizedAddresses.length < 1
      || normalizedAddresses.length > PROVIDER_EGRESS_LIMITS.maxResolvedIpv4Addresses
      || normalizedAddresses.length !== input.resolvedAddresses.length
      || normalizedAddresses.some(({ family }) => family !== 4)) {
    return fail("PROVIDER_EGRESS_ADDRESS_SET_INVALID");
  }
  const addresses = normalizedAddresses.map(({ address }) => address);

  const budget = Object.freeze({
    maxConnections: positiveBoundedInteger(
      input.budget.maxConnections,
      PROVIDER_EGRESS_LIMITS.maxConnections,
      "PROVIDER_EGRESS_CONNECTION_BUDGET_INVALID",
    ),
    maxBytesToTarget: positiveBoundedInteger(
      input.budget.maxBytesToTarget,
      PROVIDER_EGRESS_LIMITS.maxBytesToTarget,
      "PROVIDER_EGRESS_UPLOAD_BUDGET_INVALID",
    ),
    maxBytesFromTarget: positiveBoundedInteger(
      input.budget.maxBytesFromTarget,
      PROVIDER_EGRESS_LIMITS.maxBytesFromTarget,
      "PROVIDER_EGRESS_DOWNLOAD_BUDGET_INVALID",
    ),
    maxWallTimeMs: positiveBoundedInteger(
      input.budget.maxWallTimeMs,
      PROVIDER_EGRESS_LIMITS.maxWallTimeMs,
      "PROVIDER_EGRESS_WALL_TIME_BUDGET_INVALID",
    ),
  });

  return Object.freeze({
    provider: input.provider,
    hostname,
    scheme: input.scheme,
    port: input.port,
    resolvedIpv4Addresses: Object.freeze(addresses),
    budget,
  });
}

export function fixedProviderProxyArgs(provider: ExternalProviderKind): readonly string[] {
  if (provider === "httpx") {
    return Object.freeze(["-http-proxy", PROVIDER_EGRESS_LOOPBACK_PROXY_URL]);
  }
  if (provider === "nuclei") {
    return Object.freeze(["-proxy", PROVIDER_EGRESS_LOOPBACK_PROXY_URL]);
  }
  return fail("PROVIDER_EGRESS_PROVIDER_INVALID");
}
