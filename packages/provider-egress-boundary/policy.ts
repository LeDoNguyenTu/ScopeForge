import { isIP, isIPv4 } from "node:net";

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
  resolvedIpv4Addresses: readonly string[];
  budget: ProviderEgressBudget;
}

export interface ProviderEgressPolicy extends ProviderEgressPolicyInput {
  hostname: string;
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

const BLOCKED_IPV4_RANGES = Object.freeze([
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const);

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

function ipv4Integer(value: string): number {
  return value.split(".").reduce((result, part) => ((result << 8) | Number(part)) >>> 0, 0);
}

function inIpv4Cidr(value: string, base: string, prefix: number): boolean {
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (ipv4Integer(value) & mask) === (ipv4Integer(base) & mask);
}

export function isPublicProviderIpv4(value: string): boolean {
  if (!isIPv4(value)) return false;
  return !BLOCKED_IPV4_RANGES.some(([base, prefix]) => inIpv4Cidr(value, base, prefix));
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
  const addresses = [...new Set(input.resolvedIpv4Addresses)];
  if (addresses.length < 1
      || addresses.length > PROVIDER_EGRESS_LIMITS.maxResolvedIpv4Addresses
      || addresses.length !== input.resolvedIpv4Addresses.length
      || addresses.some((address) => !isPublicProviderIpv4(address))) {
    return fail("PROVIDER_EGRESS_ADDRESS_SET_INVALID");
  }

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
