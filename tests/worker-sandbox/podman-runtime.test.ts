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

function ok(stdout = ""): PodmanCommandResult {
  return { exitCode: 0, stdout, stderr: "" };
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
  it("kills, waits for termination, and force-removes the exact container before abort settles", async () => {
    const wait = deferred<PodmanCommandResult>();
    const calls: string[][] = [];
    const driver: PodmanCommandDriver = {
      async exec(_file, args) {
        calls.push([...args]);
        if (args[0] === "wait") return wait.promise;
        if (args[0] === "kill") {
          wait.resolve(ok("137\n"));
          return ok();
        }
        return ok();
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

      const operations = calls.map((args) => args[0]);
      expect(operations).toEqual(["create", "start", "wait", "kill", "rm"]);
      const containerName = "scopeforge-scan-11111111-1111-4111-8111-111111111111-22222222-2222-4222-8222-222222222222";
      expect(calls.find((args) => args[0] === "kill")).toEqual(["kill", "--signal=KILL", containerName]);
      expect(calls.find((args) => args[0] === "rm")).toEqual(["rm", "--force", containerName]);
    } finally {
      await rm(workDirectory, { recursive: true, force: true });
    }
  });

  it("copies the bounded result only after a zero exit and removes the stopped container", async () => {
    const calls: string[][] = [];
    const driver: PodmanCommandDriver = {
      async exec(_file, args) {
        calls.push([...args]);
        if (args[0] === "wait") return ok("0\n");
        return ok();
      },
    };
    const workDirectory = await mkdtemp(path.join(tmpdir(), "scopeforge-podman-success-"));
    try {
      const result = await createPodmanSandbox({ driver }).execute({
        ...BASE,
        workDirectory,
      }, new AbortController().signal);

      expect(result.resultPath).toBe(path.join(workDirectory, "result.json"));
      expect(calls.map((args) => args[0])).toEqual(["create", "start", "wait", "cp", "rm"]);
      expect(calls[3]).toEqual([
        "cp",
        `${result.containerName}:/result/result.json`,
        path.join(workDirectory, "result.json"),
      ]);
    } finally {
      await rm(workDirectory, { recursive: true, force: true });
    }
  });

  it("never copies output from a failed scanner container", async () => {
    const calls: string[][] = [];
    const driver: PodmanCommandDriver = {
      async exec(_file, args) {
        calls.push([...args]);
        if (args[0] === "wait") return ok("1\n");
        return ok();
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