import { describe, expect, it } from "vitest";
import { buildRuntimeWorkerPodmanCreateCommand } from "@/packages/runtime-worker-sandbox";

const input = {
  taskId: "11111111-1111-4111-8111-111111111111",
  attemptId: "22222222-2222-4222-8222-222222222222",
  executionClass: "passive_runtime_observation_v1" as const,
  mediatorSessionNonce: "c".repeat(64),
  podmanBinary: "/usr/bin/podman",
  image: `ghcr.io/scopeforge/runtime-worker@sha256:${"a".repeat(64)}`,
  mediatorSocketPath: `/run/scopeforge/runtime-mediator/${"b".repeat(64)}.sock`,
};

describe("Phase 6D runtime worker Podman command", () => {
  it("allows Node native threads inside a tight PID ceiling while preserving networkless mediator-only IPC", () => {
    const command = buildRuntimeWorkerPodmanCreateCommand(input);
    const joined = command.args.join(" ");

    expect(command.file).toBe("/usr/bin/podman");
    expect(command.args).toContain("--pull=never");
    expect(command.args).toContain("--network=none");
    expect(command.args).toContain("--read-only");
    expect(command.args).toContain("--cap-drop=all");
    expect(command.args).toContain("--security-opt=no-new-privileges");
    expect(command.args).toContain("--pids-limit=8");
    expect(command.args).toContain("--memory=256m");
    expect(command.args).toContain("--cpus=0.5");
    expect(command.args).toContain("--unsetenv-all");
    expect(command.args).toContain("--tmpfs=/tmp:rw,size=16777216,mode=1777,nosuid,nodev,noexec");
    expect(joined).not.toMatch(/--privileged|--device|docker[.]sock|podman[.]sock|\/var\/run/);

    const mounts = command.args.filter((arg) => arg.startsWith("--mount="));
    expect(mounts).toEqual([
      `--mount=type=bind,src=${input.mediatorSocketPath},dst=/run/scopeforge/mediator.sock,ro`,
    ]);
    expect(command.args.slice(-9)).toEqual([
      "/app/runtime-worker-entry.js",
      "--task-id", input.taskId,
      "--attempt-id", input.attemptId,
      "--execution-class", input.executionClass,
      "--session-nonce", input.mediatorSessionNonce,
    ]);
  });

  it("enforces the smaller active CORS scratch budget at the container boundary", () => {
    const command = buildRuntimeWorkerPodmanCreateCommand({
      ...input,
      executionClass: "active_cors_validation_v1",
    });

    expect(command.args).toContain("--cpus=0.5");
    expect(command.args).toContain("--tmpfs=/tmp:rw,size=8388608,mode=1777,nosuid,nodev,noexec");
    expect(command.args).not.toContain("--tmpfs=/tmp:rw,size=16777216,mode=1777,nosuid,nodev,noexec");
  });

  it("rejects task-controlled socket paths and argument injection", () => {
    for (const mediatorSocketPath of [
      "/tmp/mediator.sock",
      "/run/scopeforge/runtime-mediator/../../podman.sock",
      "/run/scopeforge/runtime-mediator/x.sock,--privileged",
      "/run/scopeforge/runtime-mediator/x.sock\n--privileged",
    ]) {
      expect(() => buildRuntimeWorkerPodmanCreateCommand({ ...input, mediatorSocketPath })).toThrow();
    }

    expect(() => buildRuntimeWorkerPodmanCreateCommand({
      ...input,
      image: "alpine:latest --privileged",
    })).toThrow();
    expect(() => buildRuntimeWorkerPodmanCreateCommand({
      ...input,
      mediatorSessionNonce: "bad --privileged",
    })).toThrow();
    expect(() => buildRuntimeWorkerPodmanCreateCommand({
      ...input,
      executionClass: "foundation_no_egress_v1" as never,
    })).toThrow();
  });
});
