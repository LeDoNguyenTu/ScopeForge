import { describe, expect, it } from "vitest";
import {
  createRuntimeMediatorFrameDecoder,
  encodeRuntimeMediatorFrame,
} from "@/packages/runtime-worker-mediator/unix-client";

const request = {
  operation: "run" as const,
  session: {
    taskId: "11111111-1111-4111-8111-111111111111",
    attemptId: "22222222-2222-4222-8222-222222222222",
    executionClass: "passive_runtime_observation_v1" as const,
    nonce: "a".repeat(64),
  },
};

describe("runtime mediator Unix socket framing", () => {
  it("uses a bounded 4-byte big-endian length-prefixed JSON frame", () => {
    const frame = encodeRuntimeMediatorFrame(request, 4_096);
    const size = frame.readUInt32BE(0);
    expect(size).toBe(frame.length - 4);
    expect(JSON.parse(frame.subarray(4).toString("utf8"))).toEqual(request);
  });

  it("decodes split frames without parsing before the complete payload arrives", () => {
    const frame = encodeRuntimeMediatorFrame(request, 4_096);
    const decoder = createRuntimeMediatorFrameDecoder(4_096);
    expect(decoder.push(frame.subarray(0, 4))).toEqual([]);
    expect(decoder.hasPendingData()).toBe(true);
    expect(decoder.push(frame.subarray(4, 12))).toEqual([]);
    expect(decoder.hasPendingData()).toBe(true);
    expect(decoder.push(frame.subarray(12))).toEqual([request]);
    expect(decoder.hasPendingData()).toBe(false);
  });

  it("exposes trailing partial frame bytes so a one-request socket can reject them", () => {
    const frame = encodeRuntimeMediatorFrame(request, 4_096);
    const decoder = createRuntimeMediatorFrameDecoder(4_096, "request");
    expect(decoder.push(Buffer.concat([frame, Buffer.from([0, 0])]))).toEqual([request]);
    expect(decoder.hasPendingData()).toBe(true);
  });

  it("rejects an oversized declared frame from the length header alone", () => {
    const header = Buffer.alloc(4);
    header.writeUInt32BE(4_097, 0);
    const decoder = createRuntimeMediatorFrameDecoder(4_096);
    expect(() => decoder.push(header)).toThrow();
  });

  it("rejects strict-schema violations after JSON decode", () => {
    const invalid = { ...request, url: "https://forbidden.example" };
    const frame = encodeRuntimeMediatorFrame(invalid, 4_096);
    const decoder = createRuntimeMediatorFrameDecoder(4_096, "request");
    expect(() => decoder.push(frame)).toThrow();
  });
});
