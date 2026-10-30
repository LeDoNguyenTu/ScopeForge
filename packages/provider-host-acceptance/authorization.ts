import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import {
  createProviderEgressPolicy,
  PROVIDER_EGRESS_LIMITS,
  type ProviderEgressPolicy,
} from "../provider-egress-boundary";

export interface AcceptanceAuthorization {
  schemaVersion: 1;
  purpose: "phase12-controlled-acceptance";
  reviewedBy: "LeDoNguyenTu";
  authorizationId: string;
  sourceSha: string;
  providerImage: string;
  sidecarImage: string;
  expiresAt: string;
  target: { hostname: string; scheme: "http" | "https"; port: number };
  approvedIpv4Addresses: readonly string[];
}

function fail(): never { throw new Error("PHASE12_ACCEPTANCE_AUTHORITY_INVALID"); }

function exactObject(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail();
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, i) => key !== expected[i])) return fail();
  return value as Record<string, unknown>;
}

/** The digest must be reviewed out of band; this is a bounded authority file, not a signature. */
export function validateAcceptanceAuthorization(
  bytes: Buffer, reviewedSha256: string, sourceSha: string, now = Date.now(),
): Readonly<AcceptanceAuthorization> {
  if (bytes.length > 4096 || !/^[a-f0-9]{64}$/.test(reviewedSha256)
      || createHash("sha256").update(bytes).digest("hex") !== reviewedSha256) return fail();
  let parsed: unknown;
  try { parsed = JSON.parse(bytes.toString("utf8")); } catch { return fail(); }
  const value = exactObject(parsed, ["schemaVersion", "purpose", "reviewedBy", "authorizationId",
    "sourceSha", "providerImage", "sidecarImage", "expiresAt", "target", "approvedIpv4Addresses"]);
  const target = exactObject(value.target, ["hostname", "scheme", "port"]);
  const image = /^[a-z0-9][a-z0-9._:/-]*@sha256:[a-f0-9]{64}$/;
  if (value.schemaVersion !== 1 || value.purpose !== "phase12-controlled-acceptance"
      || value.reviewedBy !== "LeDoNguyenTu" || !/^[a-f0-9]{40}$/.test(sourceSha)
      || value.sourceSha !== sourceSha || typeof value.authorizationId !== "string"
      || !/^phase12-acceptance:[A-Za-z0-9._-]{1,80}$/.test(value.authorizationId)
      || typeof value.providerImage !== "string" || !image.test(value.providerImage)
      || typeof value.sidecarImage !== "string" || !image.test(value.sidecarImage)
      || typeof value.expiresAt !== "string" || typeof target.hostname !== "string"
      || (target.scheme !== "http" && target.scheme !== "https") || typeof target.port !== "number"
      || !Array.isArray(value.approvedIpv4Addresses)
      || value.approvedIpv4Addresses.some((address) => typeof address !== "string")) return fail();
  const expiry = Date.parse(value.expiresAt);
  if (!Number.isFinite(expiry) || expiry <= now || expiry - now > 86_400_000) return fail();
  const policy = createProviderEgressPolicy({ provider: "httpx", hostname: target.hostname,
    scheme: target.scheme, port: target.port, resolvedAddresses: value.approvedIpv4Addresses,
    budget: PROVIDER_EGRESS_LIMITS });
  if (policy.hostname !== target.hostname) return fail();
  return Object.freeze({ schemaVersion: 1, purpose: "phase12-controlled-acceptance",
    reviewedBy: "LeDoNguyenTu", authorizationId: value.authorizationId, sourceSha,
    providerImage: value.providerImage, sidecarImage: value.sidecarImage, expiresAt: value.expiresAt,
    target: Object.freeze({ hostname: policy.hostname, scheme: policy.scheme, port: policy.port }),
    approvedIpv4Addresses: policy.resolvedIpv4Addresses });
}

export async function prepareHostTunnelAcceptance(
  authorization: Readonly<AcceptanceAuthorization>,
  resolveAll: (hostname: string) => Promise<readonly string[]> = async (hostname) =>
    (await lookup(hostname, { all: true, verbatim: true })).map(({ address }) => address),
): Promise<Readonly<ProviderEgressPolicy>> {
  // Never filter a hostile answer out before the shared policy sees the full set.
  const resolvedAddresses = await resolveAll(authorization.target.hostname);
  const policy = createProviderEgressPolicy({ provider: "httpx", ...authorization.target,
    resolvedAddresses, budget: PROVIDER_EGRESS_LIMITS });
  const approved = [...authorization.approvedIpv4Addresses].sort();
  const actual = [...policy.resolvedIpv4Addresses].sort();
  if (actual.length !== approved.length || actual.some((address, i) => address !== approved[i])) return fail();
  return policy;
}
