import type { ProviderEgressPolicy } from "./policy";

export interface ProviderEgressSession {
  nonce: string;
  expiresAt: string;
}

export interface ProviderEgressConnectFrame {
  schemaVersion: 1;
  operation: "connect";
  nonce: string;
  hostname: string;
  port: number;
}

export interface ProviderEgressAuthorizedConnection {
  address: string;
  port: number;
  connectionNumber: number;
}

export interface ProviderEgressTraffic {
  bytesToTarget: number;
  bytesFromTarget: number;
}

export interface ProviderEgressSnapshot extends ProviderEgressTraffic {
  connections: number;
}

const FRAME_KEYS = Object.freeze(["hostname", "nonce", "operation", "port", "schemaVersion"]);

function fail(code: string): never {
  throw new Error(code);
}

function exactFrame(value: unknown): ProviderEgressConnectFrame {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return fail("PROVIDER_EGRESS_FRAME_INVALID");
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (keys.length !== FRAME_KEYS.length
      || keys.some((key, index) => key !== FRAME_KEYS[index])) {
    return fail("PROVIDER_EGRESS_FRAME_INVALID");
  }
  if (record.schemaVersion !== 1
      || record.operation !== "connect"
      || typeof record.nonce !== "string"
      || typeof record.hostname !== "string"
      || !Number.isInteger(record.port)) {
    return fail("PROVIDER_EGRESS_FRAME_INVALID");
  }
  return record as unknown as ProviderEgressConnectFrame;
}

function boundedTraffic(value: number, code: string): number {
  if (!Number.isSafeInteger(value) || value < 0) return fail(code);
  return value;
}

export function createProviderEgressAuthorizer(input: Readonly<{
  policy: Readonly<ProviderEgressPolicy>;
  session: Readonly<ProviderEgressSession>;
  now?: () => number;
}>) {
  if (!/^[a-f0-9]{64}$/.test(input.session.nonce)) {
    fail("PROVIDER_EGRESS_SESSION_INVALID");
  }
  const expiresAt = Date.parse(input.session.expiresAt);
  if (!Number.isFinite(expiresAt)) fail("PROVIDER_EGRESS_SESSION_INVALID");

  const now = input.now ?? Date.now;
  let connections = 0;
  let bytesToTarget = 0;
  let bytesFromTarget = 0;

  function assertLive(): void {
    if (now() >= expiresAt) fail("PROVIDER_EGRESS_SESSION_EXPIRED");
  }

  return Object.freeze({
    authorizeConnect(value: unknown): Readonly<ProviderEgressAuthorizedConnection> {
      assertLive();
      const frame = exactFrame(value);
      if (frame.nonce !== input.session.nonce) fail("PROVIDER_EGRESS_SESSION_MISMATCH");
      if (frame.hostname.toLowerCase() !== input.policy.hostname
          || frame.port !== input.policy.port) {
        fail("PROVIDER_EGRESS_TARGET_MISMATCH");
      }
      if (connections >= input.policy.budget.maxConnections) {
        fail("PROVIDER_EGRESS_CONNECTION_BUDGET_EXHAUSTED");
      }
      const address = input.policy.resolvedIpv4Addresses[
        connections % input.policy.resolvedIpv4Addresses.length
      ];
      if (!address) fail("PROVIDER_EGRESS_ADDRESS_SET_INVALID");
      connections += 1;
      return Object.freeze({
        address,
        port: input.policy.port,
        connectionNumber: connections,
      });
    },

    recordTraffic(traffic: Readonly<ProviderEgressTraffic>): void {
      assertLive();
      const nextToTarget = bytesToTarget
        + boundedTraffic(traffic.bytesToTarget, "PROVIDER_EGRESS_TRAFFIC_INVALID");
      const nextFromTarget = bytesFromTarget
        + boundedTraffic(traffic.bytesFromTarget, "PROVIDER_EGRESS_TRAFFIC_INVALID");
      if (nextToTarget > input.policy.budget.maxBytesToTarget) {
        fail("PROVIDER_EGRESS_UPLOAD_BUDGET_EXHAUSTED");
      }
      if (nextFromTarget > input.policy.budget.maxBytesFromTarget) {
        fail("PROVIDER_EGRESS_DOWNLOAD_BUDGET_EXHAUSTED");
      }
      bytesToTarget = nextToTarget;
      bytesFromTarget = nextFromTarget;
    },

    snapshot(): Readonly<ProviderEgressSnapshot> {
      return Object.freeze({ connections, bytesToTarget, bytesFromTarget });
    },
  });
}
