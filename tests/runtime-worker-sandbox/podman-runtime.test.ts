import { describe, expect, it, vi } from "vitest";
import { createRuntimeWorkerSandbox } from "@/packages/runtime-worker-sandbox";

const baseInput = {
  taskId: "11111111-1111-4111-8111-111111111111",
  attemptId: "22222222-2222-4222-8222-222222222222",
  mediatorSessionNonce: "c".repeat(64),
  podmanBinary: "/usr/bin/podman",
  image: `ghcr.io/scopeforge/runtime-worker@sha256:${"a".repeat(64)}`,
  mediatorSocketPath: `/run/scopeforge/runtime-mediator/${"b".repeat(64)}.sock`,
};

function driver() {
  const exec = vi.fn(async (_file: string, args: readonly string[]) => {
    if (args[0] === "wait") return { exitCode: 0, stdout: "0\n" };
    if (args[0] === "start") return { exitCode: 0, stdout: "{}" };
    return { exitCode: 0, stdout: "" };
  });
  return { exec };
}

function startOptions(exec: ReturnType<typeof vi.fn>) {
  const call = exec.mock.calls.find(([, args]) => args[0] === "start");
  expect(call).toBeDefined();
  return call?.[2] as { timeoutMs: number; maxOutputBytes: number };
}

describe("Phase 6D Podman runtime limits", () => {
  it("caps passive attach time and output at the passive contract boundary", async () => {
    const controlled = driver();
    const sandbox = createRuntimeWorkerSandbox({ driver: controlled });

    await sandbox.execute({
      ...baseInput,
      executionClass: "passive_runtime_observation_v1",
    }, new AbortController().signal);

    expect(startOptions(controlled.exec)).toEqual({
      timeoutMs: 30_000,
      maxOutputBytes: 131_072,
    });
  });

  it("caps active CORS attach time and output at the smaller active contract boundary", async () => {
    const controlled = driver();
    const sandbox = createRuntimeWorkerSandbox({ driver: controlled });

    await sandbox.execute({
      ...baseInput,
      executionClass: "active_cors_validation_v1",
    }, new AbortController().signal);

    expect(startOptions(controlled.exec)).toEqual({
      timeoutMs: 20_000,
      maxOutputBytes: 65_536,
    });
  });
});
