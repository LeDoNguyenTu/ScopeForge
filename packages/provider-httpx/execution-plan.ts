import type { HttpxProviderRequest, HttpxProbe } from ".";

export const HTTPX_EXECUTABLE_PROFILE_ID = "projectdiscovery-httpx-1.12.0-bounded-v1";
export const HTTPX_LINUX_AMD64_ZIP_SHA256 = "9d8439e8b6c9aa7d1e2314817a392e00d5178da3af5652f7475f88868f418f76";
export const HTTPX_LINUX_ARM64_ZIP_SHA256 = "fd7b123c1dfbc3d69f19f524e4eebcd6ec06b9a6cbd56813c76f11645197331e";

export interface HttpxExecutionPlan {
  profileId: typeof HTTPX_EXECUTABLE_PROFILE_ID;
  executable: "httpx";
  args: readonly string[];
}

const PROBE_ARGUMENTS: Readonly<Record<HttpxProbe, readonly string[]>> = Object.freeze({
  status: Object.freeze(["-sc"]),
  title: Object.freeze(["-title"]),
  server: Object.freeze(["-server"]),
  content_type: Object.freeze(["-ct"]),
  tls: Object.freeze(["-tls-grab"]),
  tech: Object.freeze(["-td"]),
});

function targetAuthority(request: Readonly<HttpxProviderRequest>, hostname: string): string {
  if (!/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i.test(hostname) || hostname.length > 253) {
    throw new Error("HTTPX_TRUSTED_HOSTNAME_INVALID");
  }
  return `${request.scheme}://${hostname.toLowerCase()}:${request.port}`;
}

export function buildHttpxExecutionPlan(
  request: Readonly<HttpxProviderRequest>,
  trustedHostname: string,
): Readonly<HttpxExecutionPlan> {
  if (request.maxRedirects !== 0) {
    throw new Error("HTTPX_REDIRECT_PROFILE_NOT_RUNTIME_APPROVED");
  }

  const target = targetAuthority(request, trustedHostname);
  const args = [
    "-u",
    target,
    "-json",
    "-silent",
    "-no-color",
    "-no-stdin",
    "-nfs",
    "-retries",
    "0",
    "-t",
    "1",
    "-rl",
    "1",
    "-timeout",
    "5",
    ...request.probes.flatMap((probe) => PROBE_ARGUMENTS[probe]),
  ];

  return Object.freeze({
    profileId: HTTPX_EXECUTABLE_PROFILE_ID,
    executable: "httpx",
    args: Object.freeze(args),
  });
}
