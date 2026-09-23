import type { ProviderEgressPolicy } from "./policy";

export const SOCKS5_NO_AUTH_RESPONSE = Buffer.from([0x05, 0x00]);
export const SOCKS5_CONNECT_SUCCESS_RESPONSE =
  Buffer.from([0x05, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);

export interface Socks5Greeting {
  consumedBytes: number;
}

export interface Socks5ConnectRequest {
  hostname: string;
  port: number;
  consumedBytes: number;
}

function fail(code: string): never {
  throw new Error(code);
}

export function parseSocks5Greeting(buffer: Buffer): Socks5Greeting | null {
  if (buffer.length < 2) return null;
  if (buffer[0] !== 0x05) return fail("PROVIDER_EGRESS_SOCKS_VERSION_INVALID");
  const methodCount = buffer[1] ?? 0;
  if (methodCount < 1 || methodCount > 16) {
    return fail("PROVIDER_EGRESS_SOCKS_METHODS_INVALID");
  }
  const total = 2 + methodCount;
  if (buffer.length < total) return null;
  const methods = buffer.subarray(2, total);
  if (!methods.includes(0x00)) return fail("PROVIDER_EGRESS_SOCKS_NO_AUTH_REQUIRED");
  return Object.freeze({ consumedBytes: total });
}

export function parseAuthorizedSocks5ConnectRequest(
  buffer: Buffer,
  policy: Readonly<ProviderEgressPolicy>,
): Socks5ConnectRequest | null {
  if (buffer.length < 5) return null;
  if (buffer[0] !== 0x05 || buffer[1] !== 0x01 || buffer[2] !== 0x00) {
    return fail("PROVIDER_EGRESS_SOCKS_CONNECT_INVALID");
  }

  // Domain-name addressing is mandatory. Literal-IP requests cannot bypass the
  // authoritative target hostname and host-side pinned address set.
  if (buffer[3] !== 0x03) return fail("PROVIDER_EGRESS_SOCKS_ADDRESS_TYPE_INVALID");

  const hostnameLength = buffer[4] ?? 0;
  if (hostnameLength < 1 || hostnameLength > 253) {
    return fail("PROVIDER_EGRESS_SOCKS_HOST_INVALID");
  }
  const total = 5 + hostnameLength + 2;
  if (buffer.length < total) return null;

  const hostnameBytes = buffer.subarray(5, 5 + hostnameLength);
  if ([...hostnameBytes].some((byte) => byte > 0x7f)) {
    return fail("PROVIDER_EGRESS_SOCKS_HOST_INVALID");
  }
  const hostname = hostnameBytes.toString("ascii").toLowerCase();
  const port = buffer.readUInt16BE(5 + hostnameLength);

  if (hostname !== policy.hostname || port !== policy.port) {
    return fail("PROVIDER_EGRESS_TARGET_MISMATCH");
  }

  return Object.freeze({ hostname, port, consumedBytes: total });
}
