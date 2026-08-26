import { describe, expect, it } from "vitest";
import { buildPodmanCreateCommand } from "@/packages/worker-sandbox";

const INPUT = {
  podmanBinary: "/usr/bin/podman",
  image: `ghcr.io/scopeforge/scanner@sha256:${"a".repeat(64)}`,
  taskId: "11111111-1111-4111-8111-111111111111",
  attemptId: "22222222-2222-4222-8222-222222222222",
  sourceDirectory: "/var/lib/scopeforge/work/111/source",
  taskMetadataPath: "/var/lib/scopeforge/work/111/task.json",
};

describe("Phase 6C Podman sandbox command", () => {
  it("constructs a closed rootless zero-egress container configuration", () => {
    const command = buildPodmanCreateCommand(INPUT);

    expect(command.file).toBe("/usr/bin/podman");
    expect(command.containerName).toBe(
      "scopeforge-scan-11111111-1111-4111-8111-111111111111-22222222-2222-4222-8222-222222222222",
    );
    expect(command.args).toEqual([
      "create",
      "--name", command.containerName,
      "--pull=never",
      "--network=none",
      "--read-only",
      "--read-only-tmpfs=false",
      "--cap-drop=all",
      "--security-opt=no-new-privileges",
      "--pids-limit=64",
      "--memory=1g",
      "--cgroup-conf=memory.swap.max=0",
      "--cpus=1",
      "--log-driver=none",
      "--user=65532:65532",
      "--unsetenv-all",
      "--tmpfs=/tmp:rw,size=268435456,mode=0700,nosuid,nodev,noexec",
      "--tmpfs=/result:rw,size=4194304,mode=0700,nosuid,nodev,noexec",
      "--mount=type=bind,src=/var/lib/scopeforge/work/111/source,dst=/workspace,ro=true",
      "--mount=type=bind,src=/var/lib/scopeforge/work/111/task.json,dst=/scopeforge/task.json,ro=true",
      "--entrypoint=/usr/local/bin/node",
      INPUT.image,
      "/app/hosted-scanner-entry.js",
    ]);
  });

  it("rejects mutable images, relative binaries/paths, and mount-option injection", () => {
    for (const invalid of [
      { ...INPUT, image: "ghcr.io/scopeforge/scanner:latest" },
      { ...INPUT, image: `https://evil.invalid/scanner@sha256:${"a".repeat(64)}` },
      { ...INPUT, podmanBinary: "podman" },
      { ...INPUT, sourceDirectory: "relative/source" },
      { ...INPUT, sourceDirectory: "/safe/source,ro=false" },
      { ...INPUT, taskMetadataPath: "/safe/task.json,dst=/etc/passwd" },
      { ...INPUT, taskId: "not-a-uuid" },
    ]) {
      expect(() => buildPodmanCreateCommand(invalid)).toThrow();
    }
  });

  it("contains no privilege, host-network, device, shell, socket, or implicit-swap escape options", () => {
    const command = buildPodmanCreateCommand(INPUT);
    const joined = command.args.join(" ");
    for (const forbidden of [
      "--privileged",
      "--network=host",
      "--pid=host",
      "--ipc=host",
      "--device",
      "--memory-swap",
      "docker.sock",
      "podman.sock",
      "/bin/sh",
      "bash -c",
    ]) {
      expect(joined).not.toContain(forbidden);
    }
  });
});