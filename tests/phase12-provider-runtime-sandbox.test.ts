import { describe, expect, it, vi } from "vitest";
import {
  buildExternalProviderSandboxPlan,
  createExternalProviderSandbox,
  type ExternalProviderSandboxCommandDriver,
} from "../packages/provider-runtime-sandbox";

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";
const DIGEST_A = `localhost/scopeforge-httpx-worker@sha256:${"a".repeat(64)}`;
const DIGEST_B = `localhost/scopeforge-provider-egress-sidecar@sha256:${"b".repeat(64)}`;
const SOCKET = `/run/scopeforge-worker/egress/${"c".repeat(64)}.sock`;
const NONCE = "d".repeat(64);

function httpxInput() {
  return {
    taskId: UUID_A,
    attemptId: UUID_B,
    provider: "httpx" as const,
    podmanBinary: "/usr/bin/podman",
    providerImage: DIGEST_A,
    sidecarImage: DIGEST_B,
    egressSocketPath: SOCKET,
    sessionNonce: NONCE,
    workspaceId: UUID_A,
    actionId: "phase12-action:one",
    authorizationId: "phase12-auth:one",
    targetNodeId: "node-1",
    trustedHostname: "ScopeForge.dev",
    scheme: "https" as const,
    port: 443,
    maxRuntimeMs: 5_000,
    probes: ["status", "title"] as const,
  };
}

describe("Phase 12 external provider sandbox", () => {
  it("gives only the trusted sidecar the networkless namespace, Unix socket and nonce", () => {
    const plan = buildExternalProviderSandboxPlan(httpxInput());

    expect(plan.sidecar.args).toContain("--network=none");
    expect(plan.sidecar.args.join(" ")).toContain(SOCKET);
    expect(plan.sidecar.args).toContain(NONCE);
    expect(plan.sidecar.args).toContain("--trusted-hostname");
    expect(plan.sidecar.args).toContain("scopeforge.dev");

    expect(plan.provider.args).toContain(`--network=container:${plan.sidecarName}`);
    expect(plan.provider.args.join(" ")).not.toContain(SOCKET);
    expect(plan.provider.args).not.toContain(NONCE);
    expect(plan.provider.args).not.toContain("--session-nonce");
    expect(plan.provider.args).not.toContain("--network=bridge");
    expect(plan.provider.args).not.toContain("--network=host");
  });

  it("constructs exact typed httpx runner arguments without a generic flag surface", () => {
    const plan = buildExternalProviderSandboxPlan(httpxInput());
    expect(plan.provider.args).toEqual(expect.arrayContaining([
      "/app/httpx-worker-entry.js",
      "--workspace-id", UUID_A,
      "--target-node-id", "node-1",
      "--trusted-hostname", "scopeforge.dev",
      "--scheme", "https",
      "--port", "443",
      "--max-runtime-ms", "5000",
      "--probes", "status,title",
    ]));
    expect(plan.provider.args).not.toContain("--proxy");
    expect(plan.provider.args).not.toContain("--url");
  });

  it("constructs only the baseline Nuclei profile", () => {
    const base = httpxInput();
    const plan = buildExternalProviderSandboxPlan({
      taskId: base.taskId,
      attemptId: base.attemptId,
      provider: "nuclei",
      podmanBinary: base.podmanBinary,
      providerImage: `localhost/scopeforge-nuclei-worker@sha256:${"e".repeat(64)}`,
      sidecarImage: base.sidecarImage,
      egressSocketPath: base.egressSocketPath,
      sessionNonce: base.sessionNonce,
      workspaceId: base.workspaceId,
      actionId: base.actionId,
      authorizationId: base.authorizationId,
      targetNodeId: base.targetNodeId,
      trustedHostname: base.trustedHostname,
      scheme: base.scheme,
      port: base.port,
      maxRuntimeMs: 8_000,
      templateProfile: "baseline-http",
      minimumSeverity: "low",
    });
    expect(plan.provider.args).toEqual(expect.arrayContaining([
      "/app/nuclei-worker-entry.js",
      "--template-profile", "baseline-http",
      "--minimum-severity", "low",
    ]));
    expect(plan.provider.args).not.toContain("--template");
    expect(plan.provider.args).not.toContain("--flags");
  });

  it("rejects mutable images, out-of-root sockets, unsafe targets and over-budget runtime", () => {
    expect(() => buildExternalProviderSandboxPlan({
      ...httpxInput(),
      providerImage: "localhost/scopeforge-httpx-worker:latest",
    })).toThrow(/immutable OCI digest/);
    expect(() => buildExternalProviderSandboxPlan({
      ...httpxInput(),
      egressSocketPath: `/tmp/${"a".repeat(64)}.sock`,
    })).toThrow(/fixed supervisor-owned root/);
    expect(() => buildExternalProviderSandboxPlan({
      ...httpxInput(),
      trustedHostname: "localhost",
    })).toThrow(/hostname is invalid/);
    expect(() => buildExternalProviderSandboxPlan({
      ...httpxInput(),
      maxRuntimeMs: 8_001,
    })).toThrow(/runtime budget is invalid/);
  });

  it("starts sidecar first, waits for fixed loopback readiness, then provider and cleans both", async () => {
    const calls: readonly string[][] = [];
    const mutableCalls = calls as string[][];
    const driver: ExternalProviderSandboxCommandDriver = {
      exec: vi.fn(async (_file, args) => {
        mutableCalls.push([...args]);
        if (args[0] === "exec") return { exitCode: 0, stdout: "" };
        if (args[0] === "wait") return { exitCode: 0, stdout: "0\n" };
        if (args[0] === "start" && args[1] === "--attach") {
          return { exitCode: 0, stdout: "{\"ok\":true}\n" };
        }
        return { exitCode: 0, stdout: "" };
      }),
    };
    const result = await createExternalProviderSandbox({ driver }).execute(
      httpxInput(),
      new AbortController().signal,
    );

    expect(result.output).toBe("{\"ok\":true}\n");
    expect(mutableCalls[0][0]).toBe("create");
    expect(mutableCalls[0]).toContain("--network=none");
    expect(mutableCalls[1][0]).toBe("start");
    expect(mutableCalls[2][0]).toBe("exec");
    expect(mutableCalls[3][0]).toBe("create");
    expect(mutableCalls[3].join(" ")).toContain("--network=container:");
    const removals = mutableCalls.filter((args) => args[0] === "rm");
    expect(removals).toHaveLength(2);
  });
});
