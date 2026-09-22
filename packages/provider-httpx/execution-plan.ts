import type { HttpxProviderRequest, HttpxProbe } from ".";

export const HTTPX_EXECUTABLE_PROFILE_ID = "projectdiscovery-httpx-1.12.0-bounded-v1";

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
  const target = targetAuthority(request, trustedHostname);
  const args = [
    "-u",
    target,
    "-json",
    "-silent",
    "-no-color",
    "-no-fallback",
    "-timeout",
    "5",
    "-maxr",
    String(request.maxRedirects),
    ...(request.maxRedirects > 0 ? ["-fr"] : []),
    ...request.probes.flatMap((probe) => PROBE_ARGUMENTS[probe]),
  ];

  return Object.freeze({
    profileId: HTTPX_EXECUTABLE_PROFILE_ID,
    executable: "httpx",
    args: Object.freeze(args),
  });
}
