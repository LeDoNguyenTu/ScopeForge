import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createPodmanSandbox,
  type PodmanCommandDriver,
  type PodmanCommandResult,
} from "@/packages/worker-sandbox";

const BASE = {
  podmanBinary: "/usr/bin/podman",
  image: `ghcr.io/scopeforge/scanner@sha256:${"a".repeat(64)}`,
  taskId: "11111111-1111-4111-8111-111111111111",
  attemptId: "22222222-2222-4222-8222-222222222222",
  sourceDirectory: "/var/lib/scopeforge/work/111/source",
  taskMetadataPath: "/var/lib/scopeforge/work/111/task.json",
};

function result(exitCode = 0, stdout = ""): PodmanCommandResult {
  return { exitCode, stdout, stderr: "" };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("Phase 6C Podman sandbox runtime", () => {
  it("force-removes the exact container with zero grace before abort settles", async () => {
    const attached = deferred<PodmanCommandResult>();
    const calls: string[][] = [];
    const driver: PodmanCommandDriver = {
      async exec(_file, args) {
        calls.push([...args]);
        if (args[0] === "start") return attached.promise;
        if (args[0] === "rm" && args.includes("--time=0")) {
          attached.resolve(result(137));
          return result();
        }
        return result();
      },
    };
    const workDirectory = await mkdtemp(path.join(tmpdir(), "scopeforge-podman-abort-"));
    try {
      const controller = new AbortController();
      const execution = createPodmanSandbox({ driver }).execute({
        ...BASE,
        workDirectory,
      }, controller.signal);

      await new Promise((resolve) => setTimeout(resolve, 0));
      controller.abort();
      await expect(execution).rejects.toMatchObject({ name: "AbortError" });

      const containerName = "scopeforge-scan-11111111-1111-4111-8111-111111111111-22222222-2222-4222-8222-222222222222";
      expect(calls.map((args) => args[0])).toEqual(["create", "start", "rm"]);
      expect(calls[1]).toEqual(["start", "--attach", containerName]);
      expect(calls[2]).toEqual(["rm", "--time=0", "--force", containerName]);
    } finally {
      await rm(workDirectory, { recursive: true, force: true });
    }
  });

  it("also removes a created container if cancellation wins before attached start completes", async () => {
    const calls: string[][] = [];
    const controller = new AbortController();
    const driver: PodmanCommandDriver = {
      async exec(_file, args) {
        calls.push([...args]);
        if (args[0] === "create") {
          queueMicrotask(() => controller.abort());
          return result();
        }
        if (args[0] === "rm" && args.includes("--time=0")) return result();
        return result(125);
      },
    };
    const workDirectory = await mkdtemp(path.join(tmpdir(), "scopeforge-podman-prestart-abort-"));
    try {
      await expect(createPodmanSandbox({ driver }).execute({
        ...BASE,
        workDirectory,
      }, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
      expect(calls.map((args) => args[0])).toEqual(["create", "rm"]);
      expect(calls[1]).toEqual([
        "rm",
        "--time=0",
        "--force",
        "scopeforge-scan-11111111-1111-4111-8111-111111111111-22222222-2222-4222-8222-222222222222",
      ]);
    } finally {
      await rm(workDirectory, { recursive: true, force: true });
    }
  });

  it("accepts bounded attached output only after the saved container exit code is zero", async () => {
    const calls: string[][] = [];
    const driver: PodmanCommandDriver = {
      async exec(_file, args) {
        calls.push([...args]);
        if (args[0] === "start") return result(0, '{"schemaVersion":1}\n');
        if (args[0] === "wait") return result(0, "0\n");
        return result();
      },
    };
    const workDirectory = await mkdtemp(path.join(tmpdir(), "scopeforge-podman-success-"));
    try {
      const output = await createPodmanSandbox({ driver }).execute({
        ...BASE,
        workDirectory,
      }, new AbortController().signal);

      expect(output.output).toBe('{"schemaVersion":1}\n');
      expect(calls.map((args) => args[0])).toEqual(["create", "start", "wait", "rm"]);
      expect(calls[1]).toEqual(["start", "--attach", output.containerName]);
      expect(calls[3]).toEqual(["rm", "--force", "--ignore", output.containerName]);
    } finally {
      await rm(workDirectory, { recursive: true, force: true });
    }
  });

  it("never accepts output from a failed scanner container", async () => {
    const calls: string[][] = [];
    const driver: PodmanCommandDriver = {
      async exec(_file, args) {
        calls.push([...args]);
        if (args[0] === "start") return result(1, "attacker-controlled-partial-output");
        if (args[0] === "wait") return result(0, "1\n");
        return result();
      },
    };
    const workDirectory = await mkdtemp(path.join(tmpdir(), "scopeforge-podman-fail-"));
    try {
      await expect(createPodmanSandbox({ driver }).execute({
        ...BASE,
        workDirectory,
      }, new AbortController().signal)).rejects.toThrow(/scanner container failed/i);
      expect(calls.map((args) => args[0])).toEqual(["create", "start", "wait", "rm"]);
    } finally {
      await rm(workDirectory, { recursive: true, force: true });
    }
  });
});