import type { ProviderEgressConnectFrame } from "./authorizer";

export const PROVIDER_EGRESS_TUNNEL_FRAME_MAX_BYTES = 512;
export const PROVIDER_EGRESS_TUNNEL_ACCEPTED = Buffer.from([0x00]);

function fail(code: string): never {
  throw new Error(code);
}

export function encodeProviderEgressConnectFrame(
  frame: Readonly<ProviderEgressConnectFrame>,
): Buffer {
  let payload: Buffer;
  try {
    payload = Buffer.from(JSON.stringify(frame), "utf8");
  } catch {
    return fail("PROVIDER_EGRESS_FRAME_INVALID");
  }
  if (payload.length < 1 || payload.length > PROVIDER_EGRESS_TUNNEL_FRAME_MAX_BYTES) {
    return fail("PROVIDER_EGRESS_FRAME_INVALID");
  }
  const output = Buffer.allocUnsafe(4 + payload.length);
  output.writeUInt32BE(payload.length, 0);
  payload.copy(output, 4);
  return output;
}

export interface DecodedProviderEgressConnectFrame {
  value: unknown;
  consumedBytes: number;
}

export function decodeProviderEgressConnectFrame(
  buffer: Buffer,
): DecodedProviderEgressConnectFrame | null {
  if (!Buffer.isBuffer(buffer)) return fail("PROVIDER_EGRESS_FRAME_INVALID");
  if (buffer.length < 4) return null;
  const length = buffer.readUInt32BE(0);
  if (length < 1 || length > PROVIDER_EGRESS_TUNNEL_FRAME_MAX_BYTES) {
    return fail("PROVIDER_EGRESS_FRAME_INVALID");
  }
  const total = 4 + length;
  if (buffer.length < total) return null;
  let value: unknown;
  try {
    value = JSON.parse(buffer.subarray(4, total).toString("utf8"));
  } catch {
    return fail("PROVIDER_EGRESS_FRAME_INVALID");
  }
  return Object.freeze({ value, consumedBytes: total });
}
