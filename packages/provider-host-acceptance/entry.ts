import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, stat, statfs } from "node:fs/promises";
import { prepareHostTunnelAcceptance, validateAcceptanceAuthorization } from "./authorization";
import { acceptanceAssert, runHostTunnelTransportProbes } from "./transport-probes";
import { acceptancePodman, runComposedHttpxProbe } from "./sandbox-probes";

let phase = "preflight";
async function main() {
  const [authorizationFile, authorizationDigest, ...extra] = process.argv.slice(2);
  acceptanceAssert(authorizationFile && authorizationDigest && extra.length === 0
    && process.platform === "linux" && process.versions.node.split(".")[0] === "24"
    && process.getuid?.() !== 0);
  const git = (...args: string[]) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 16_384 }).trim();
  acceptanceAssert(git("remote", "get-url", "origin") === "https://github.com/LeDoNguyenTu/ScopeForge.git"
    && git("status", "--porcelain") === "" && (await statfs("/sys/fs/cgroup")).type === 0x63677270);
  const sourceSha = git("rev-parse", "HEAD");
  const file = await stat(authorizationFile);
  acceptanceAssert(file.isFile() && file.size <= 4096);
  const bytes = await readFile(authorizationFile);
  const authorization = validateAcceptanceAuthorization(bytes, authorizationDigest, sourceSha);
  // Initial deterministic fixture contract intentionally permits only HTTP (never a generic HTTPS scanner).
  acceptanceAssert(authorization.target.scheme === "http");
  const rootless = await acceptancePodman(["info", "--format", "{{.Host.Security.Rootless}}"]);
  acceptanceAssert(rootless.exitCode === 0 && rootless.stdout.trim() === "true");
  for (const image of [authorization.providerImage, authorization.sidecarImage]) {
    const inspected = await acceptancePodman(["image", "inspect", "--format", "{{.Digest}}", image]);
    acceptanceAssert(inspected.exitCode === 0 && inspected.stdout.trim() === image.split("@")[1]);
  }
  phase = "dns";
  const policy = await prepareHostTunnelAcceptance(authorization);
  // Establish a real 200 response before using the controlled endpoint in exhaustion probes.
  phase = "provider-success";
  const success = await runComposedHttpxProbe(authorization, policy, false);
  phase = "transport-budgets";
  const transport = await runHostTunnelTransportProbes(policy);
  phase = "provider-cancellation";
  const cancellation = await runComposedHttpxProbe(authorization, policy, true);
  process.stdout.write(`${JSON.stringify({ schemaVersion: 1, result: "PASS", sourceSha,
    providerImage: authorization.providerImage, sidecarImage: authorization.sidecarImage,
    authorizationId: authorization.authorizationId,
    authorizationSha256: createHash("sha256").update(bytes).digest("hex"),
    target: authorization.target, pinnedIpv4Addresses: policy.resolvedIpv4Addresses,
    success, transport, cancellation,
    operationalProviderAccepted: false, productionEnablement: false })}\n`);
}

void main().catch((error: unknown) => {
  // Never serialize an arbitrary native error, subprocess output, authority file or response body.
  const code = error instanceof Error && /^[A-Z][A-Z0-9_]{0,80}$/.test(error.message)
    ? error.message : "PHASE12_HOST_TUNNEL_ACCEPTANCE_FAILED";
  process.stderr.write(`${JSON.stringify({ result: "FAIL", phase, code })}\n`);
  process.exitCode = 1;
});
