import { describe, expect, it } from "vitest";
import { buildRuntimeWorkerPodmanCreateCommand } from "@/packages/runtime-worker-sandbox";

const input = {
  taskId: "11111111-1111-4111-8111-111111111111",
  attemptId: "22222222-2222-4222-8222-222222222222",
  podmanBinary: "/usr/bin/podman",
  image: `ghcr.io/scopeforge/runtime-worker@sha256:${"a".repeat(64)}`,
  mediatorSocketPath: `/run/scopeforge/runtime-mediator/${"b".repeat(64)}.sock`,
};

describe("Phase 6D runtime worker Podman command", () => {
  it("creates a networkless one-process read-only executor with only mediator IPC", () => {
    const command = buildRuntimeWorkerPodmanCreateCommand(input);
    const joined = command.args.join(" ");

    expect(command.file).toBe("/usr/bin/podman");
    expect(command.args).toContain("--pull=never");
    expect(command.args).toContain("--network=none");
    expect(command.args).toContain("--read-only");
    expect(command.args).toContain("--cap-drop=all");
    expect(command.args).toContain("--security-opt=no-new-privileges");
    expect(command.args).toContain("--pids-limit=1");
    expect(command.args).toContain("--memory=256m");
    expect(command.args).toContain("--unsetenv-all");
    expect(joined).not.toMatch(/--privileged|--device|docker[.]sock|podman[.]sock|\/var\/run/);

    const mounts = command.args.filter((arg) => arg.startsWith("--mount="));
    expect(mounts).toEqual([
      `--mount=type=bind,src=${input.mediatorSocketPath},dst=/run/scopeforge/mediator.sock`,
    ]);
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
  });
});
