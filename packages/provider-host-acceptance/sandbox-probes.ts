import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import type { Socket } from "node:net";
import { createProviderEgressUnixTunnelServer, providerEgressHostSocketPath,
  type ProviderEgressPolicy } from "../provider-egress-boundary";
import { buildExternalProviderSandboxPlan, createExternalProviderSandbox,
  type ExternalProviderSandboxCommandDriver, type HttpxExternalProviderSandboxInput } from "../provider-runtime-sandbox";
import type { AcceptanceAuthorization } from "./authorization";
import { acceptanceAssert, assertAcceptanceSocketRemoved, connectAcceptanceTarget } from "./transport-probes";
import { namespaceProbeProgram } from "./namespace-probe";

export interface ResourceSnapshot { memory: string; swap: string; pids: string; cpu: string;
  effectiveCapabilities: string; boundingCapabilities: string }

export function validateResourceSnapshot(value: ResourceSnapshot, role: "provider" | "sidecar"): ResourceSnapshot {
  acceptanceAssert(value.memory === "268435456" && value.swap === "0", "PHASE12_MEMORY_LIMIT_INVALID");
  acceptanceAssert(value.pids === (role === "provider" ? "32" : "8"), "PHASE12_PID_LIMIT_INVALID");
  acceptanceAssert(value.cpu === "50000 100000", "PHASE12_CPU_LIMIT_INVALID");
  acceptanceAssert(/^0{16}$/.test(value.effectiveCapabilities) && /^0{16}$/.test(value.boundingCapabilities),
    "PHASE12_CAPABILITY_MASK_INVALID");
  return Object.freeze({ memory: value.memory, swap: value.swap, pids: value.pids, cpu: value.cpu,
    effectiveCapabilities: value.effectiveCapabilities, boundingCapabilities: value.boundingCapabilities });
}

/** Fixed executable, argv arrays, bounded stdout, and no provider credentials in the child environment. */
export const acceptanceDriver: ExternalProviderSandboxCommandDriver = {
  exec(file, args, options) {
    acceptanceAssert(file === "/usr/bin/podman");
    return new Promise((resolve, reject) => {
      execFile(file, [...args], { encoding: "utf8", timeout: options.timeoutMs,
        maxBuffer: options.maxOutputBytes, windowsHide: true,
        env: { PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
          HOME: process.env.HOME, XDG_RUNTIME_DIR: process.env.XDG_RUNTIME_DIR,
          LANG: "C.UTF-8", NODE_ENV: "production" } },
      (error, stdout) => {
        if (error && typeof error.code !== "number") return reject(new Error("PHASE12_ACCEPTANCE_PODMAN_FAILED"));
        resolve({ exitCode: error && typeof error.code === "number" ? error.code : 0, stdout: String(stdout) });
      });
    });
  },
};

export async function acceptancePodman(args: readonly string[]) {
  return acceptanceDriver.exec("/usr/bin/podman", args, { timeoutMs: 30_000, maxOutputBytes: 65_536 });
}

async function readResources(name: string, role: "provider" | "sidecar") {
  const result = await acceptancePodman(["inspect", "--format", "{{.State.Pid}}", name]);
  if (result.exitCode !== 0 || !/^[1-9][0-9]*$/.test(result.stdout.trim())) return null;
  const pid = result.stdout.trim();
  const cgroup = (await readFile(`/proc/${pid}/cgroup`, "utf8")).trim().match(/^0::(\/[^\n]*)$/)?.[1];
  acceptanceAssert(cgroup, "PHASE12_CGROUP_PATH_INVALID");
  const root = path.resolve("/sys/fs/cgroup", `.${cgroup}`);
  acceptanceAssert(root.startsWith("/sys/fs/cgroup/"), "PHASE12_CGROUP_ROOT_INVALID");
  const [memory, swap, pids, cpu] = await Promise.all(
    ["memory.max", "memory.swap.max", "pids.max", "cpu.max"].map(async (file) =>
      (await readFile(path.join(root, file), "utf8")).trim()));
  const status = await readFile(`/proc/${pid}/status`, "utf8");
  const effectiveCapabilities = status.match(/^CapEff:\s*([a-f0-9]{16})$/m)?.[1] ?? "invalid";
  const boundingCapabilities = status.match(/^CapBnd:\s*([a-f0-9]{16})$/m)?.[1] ?? "invalid";
  return validateResourceSnapshot({ memory, swap, pids, cpu, effectiveCapabilities, boundingCapabilities }, role);
}

async function assertContainerBoundary(name: string, role: "provider" | "sidecar", input: HttpxExternalProviderSandboxInput) {
  // Raw inspection contains the sidecar nonce; keep it in memory and return only bounded facts.
  const result = await acceptancePodman(["inspect", "--format", "{{json .}}", name]);
  acceptanceAssert(result.exitCode === 0);
  const inspected = JSON.parse(result.stdout);
  const host = inspected.HostConfig;
  acceptanceAssert(host.ReadonlyRootfs === true && host.Privileged === false
    && host.SecurityOpt.includes("no-new-privileges") && host.CapDrop.length > 0, "PHASE12_SECURITY_OPTIONS_INVALID");
  acceptanceAssert(inspected.Config.User === "65532:65532", "PHASE12_CONTAINER_USER_INVALID");
  const binds = inspected.Mounts.filter((mount: { Type: string }) => mount.Type === "bind");
  if (role === "provider") {
    acceptanceAssert(binds.length === 0 && host.NetworkMode.startsWith("container:")
      && !JSON.stringify(inspected.Config).includes(input.sessionNonce), "PHASE12_PROVIDER_MOUNT_INVALID");
  } else {
    acceptanceAssert(host.NetworkMode === "none" && binds.length === 1
      && binds[0].Source === input.egressSocketPath && binds[0].Destination === "/run/scopeforge/egress.sock"
      && binds[0].RW === false, "PHASE12_SIDECAR_MOUNT_INVALID");
  }
  const scratch = inspected.Mounts.find((mount: { Destination: string }) => mount.Destination === "/tmp");
  const scratchConfig = JSON.stringify(scratch ?? host.Tmpfs?.["/tmp"]);
  acceptanceAssert(scratchConfig && scratchConfig.includes("noexec") && scratchConfig.includes("nosuid")
    && scratchConfig.includes("nodev") && /size=(?:8388608|8192k|8m)/.test(scratchConfig), "PHASE12_SCRATCH_LIMIT_INVALID");
}

export async function runComposedHttpxProbe(
  authorization: Readonly<AcceptanceAuthorization>, policy: Readonly<ProviderEgressPolicy>, cancel: boolean,
) {
  const nonce = randomBytes(32).toString("hex");
  const socketPath = providerEgressHostSocketPath(randomBytes(32).toString("hex"));
  const controller = new AbortController();
  const active = new Set<Socket>();
  const connector = connectAcceptanceTarget(policy, active);
  const tunnel = createProviderEgressUnixTunnelServer({ socketPath, policy,
    session: { nonce, expiresAt: new Date(Date.now() + policy.budget.maxWallTimeMs).toISOString() },
    signal: controller.signal, connectTarget: connector.connectTarget });
  const taskId = randomUUID();
  const input: HttpxExternalProviderSandboxInput = { provider: "httpx", taskId, attemptId: randomUUID(),
    workspaceId: taskId, actionId: "phase12-acceptance:httpx", authorizationId: authorization.authorizationId,
    targetNodeId: "phase12-controlled-fixture", podmanBinary: "/usr/bin/podman",
    providerImage: authorization.providerImage, sidecarImage: authorization.sidecarImage,
    egressSocketPath: socketPath, sessionNonce: nonce, trustedHostname: policy.hostname,
    scheme: policy.scheme, port: policy.port, maxRuntimeMs: 8_000, probes: ["status"] };
  const plan = buildExternalProviderSandboxPlan(input);
  const probeName = `${plan.providerName}-probe`;
  let namespace: Record<string, boolean> | null = null;
  let providerResources: ResourceSnapshot | null = null;
  let sidecarResources: ResourceSnapshot | null = null;
  let outputBytes = 0;
  let cancelledWithActiveTarget = false;
  const driver: ExternalProviderSandboxCommandDriver = {
    async exec(file, args, options) {
      if (args[0] === "start" && args[1] === "--attach") {
        const attached = acceptanceDriver.exec(file, args, options);
        // Attach errors are consumed immediately while the observer samples the actual running process.
        const settled = attached.then((value) => ({ value }), () => ({ failed: true as const }));
        try {
          for (let i = 0; i < 80; i += 1) {
            providerResources ??= await readResources(plan.providerName, "provider");
            if (providerResources && (!cancel || active.size > 0)) break;
            await new Promise<void>((resolve) => setTimeout(resolve, 25));
          }
          acceptanceAssert(providerResources, "PHASE12_PROVIDER_CGROUP_NOT_OBSERVED");
          if (cancel) {
            acceptanceAssert(active.size > 0, "PHASE12_CANCEL_TARGET_NOT_ACTIVE");
            cancelledWithActiveTarget = true;
            controller.abort();
          }
        } catch (error) { controller.abort(); await settled; throw error; }
        const result = await settled;
        if (!("value" in result)) throw new Error("PHASE12_ACCEPTANCE_ATTACH_FAILED");
        return result.value;
      }
      const result = await acceptanceDriver.exec(file, args, options);
      if (result.exitCode === 0 && args[0] === "create") {
        const role = args.includes(plan.providerName) ? "provider" : "sidecar";
        await assertContainerBoundary(role === "provider" ? plan.providerName : plan.sidecarName, role, input);
        if (role === "provider") {
          const probeArgs = [...plan.provider.args.slice(0, plan.provider.args.indexOf(input.providerImage) + 1),
            "--v8-pool-size=1", "-e", namespaceProbeProgram(policy.hostname, policy.port)];
          probeArgs[probeArgs.indexOf("--name") + 1] = probeName;
          const created = await acceptancePodman(probeArgs);
          acceptanceAssert(created.exitCode === 0, "PHASE12_NAMESPACE_CREATE_FAILED");
          const tested = await acceptancePodman(["start", "--attach", probeName]);
          acceptanceAssert(tested.exitCode === 0, "PHASE12_NAMESPACE_PROBE_FAILED");
          namespace = JSON.parse(tested.stdout);
          acceptanceAssert(namespace && Object.values(namespace).length === 8
            && Object.values(namespace).every((value) => value === true) && connector.dials.length === 0,
          "PHASE12_NAMESPACE_EVIDENCE_INVALID");
          acceptanceAssert((await acceptancePodman(["rm", "--force", "--ignore", probeName])).exitCode === 0);
        }
      }
      if (result.exitCode === 0 && args[0] === "start" && args[1] === plan.sidecarName) {
        sidecarResources = await readResources(plan.sidecarName, "sidecar");
        acceptanceAssert(sidecarResources, "PHASE12_SIDECAR_CGROUP_NOT_OBSERVED");
      }
      return result;
    },
  };
  try {
    await tunnel.start();
    try {
      const result = await createExternalProviderSandbox({ driver }).execute(input, controller.signal);
      acceptanceAssert(!cancel);
      const record = JSON.parse(result.output).record;
      if (!record || record.status !== 200 || connector.dials.length === 0
          || tunnel.snapshot().bytesToTarget === 0 || tunnel.snapshot().bytesFromTarget === 0) {
        process.stderr.write(`${JSON.stringify({ phase: "provider-summary", hasRecord: Boolean(record),
          status: Number.isInteger(record?.status) ? record.status : null,
          dialCount: connector.dials.length, traffic: tunnel.snapshot() })}\n`);
      }
      acceptanceAssert(record?.status === 200 && connector.dials.length > 0
        && tunnel.snapshot().bytesToTarget > 0 && tunnel.snapshot().bytesFromTarget > 0,
      "PHASE12_PROVIDER_RESULT_INVALID");
      outputBytes = Buffer.byteLength(result.output);
      acceptanceAssert(outputBytes <= 32_768);
    } catch (error) {
      if (!cancel || !(error instanceof DOMException) || error.name !== "AbortError") throw error;
      acceptanceAssert(cancelledWithActiveTarget);
    }
  } finally {
    controller.abort();
    // Both removals are always attempted, including after partial create/start failure.
    const removed: boolean[] = [];
    for (const name of [plan.providerName, probeName, plan.sidecarName]) {
      const first = await acceptancePodman(["rm", "--time=0", "--force", "--ignore", name]);
      const second = await acceptancePodman(["rm", "--time=0", "--force", "--ignore", name]);
      const exists = await acceptancePodman(["container", "exists", name]);
      removed.push(first.exitCode === 0 && second.exitCode === 0 && exists.exitCode === 1);
    }
    await tunnel.close(); await tunnel.close();
    await assertAcceptanceSocketRemoved(socketPath);
    acceptanceAssert(removed.every(Boolean) && [...active].every((socket) => socket.destroyed),
      "PHASE12_CLEANUP_FAILED");
  }
  return { scenario: cancel ? "cancellation" : "success", dials: connector.dials,
    traffic: tunnel.snapshot(), namespace, providerResources, sidecarResources, outputBytes, cleanup: true };
}
