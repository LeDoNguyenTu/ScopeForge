import type {
  NucleiRunnerRequest,
  NucleiSeverity,
} from ".";
import { fixedProviderProxyArgs } from "../provider-egress-boundary";
import {
  NUCLEI_BASELINE_TEMPLATE_ID,
  NUCLEI_BASELINE_TEMPLATE_PATH,
} from "./runtime-profile";

export const NUCLEI_EXECUTABLE_PROFILE_ID =
  "projectdiscovery-nuclei-3.11.1-baseline-http-v1";
export const NUCLEI_LINUX_AMD64_ZIP_SHA256 =
  "ea63d4ae232808cd7c6bc00d0142428e231fab59dae01042246097d195835ab6";
export const NUCLEI_LINUX_ARM64_ZIP_SHA256 =
  "8044e3d9768ba0a744b2872c1a87e813006f013da97ca9f50f7661a4203bec07";

export interface NucleiExecutionPlan {
  profileId: typeof NUCLEI_EXECUTABLE_PROFILE_ID;
  executable: "nuclei";
  args: readonly string[];
}

function targetAuthority(scheme: "http" | "https", port: number, hostname: string): string {
  if (!/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i.test(hostname) || hostname.length > 253) {
    throw new Error("NUCLEI_TRUSTED_HOSTNAME_INVALID");
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("NUCLEI_TARGET_PORT_INVALID");
  }
  return `${scheme}://${hostname.toLowerCase()}:${port}`;
}

function minimumSeverity(value: NucleiSeverity): NucleiSeverity {
  if (!["info", "low", "medium", "high", "critical"].includes(value)) {
    throw new Error("NUCLEI_MINIMUM_SEVERITY_INVALID");
  }
  return value;
}

export function buildNucleiExecutionPlan(
  request: Readonly<NucleiRunnerRequest>,
  target: Readonly<{ hostname: string; scheme: "http" | "https"; port: number }>,
): Readonly<NucleiExecutionPlan> {
  if (request.templateProfile !== "baseline-http") {
    throw new Error("NUCLEI_RUNTIME_PROFILE_DISABLED");
  }
  if (request.approvedTemplateIds.length !== 1
      || request.approvedTemplateIds[0] !== NUCLEI_BASELINE_TEMPLATE_ID) {
    throw new Error("NUCLEI_RUNTIME_TEMPLATE_SET_INVALID");
  }

  const url = targetAuthority(target.scheme, target.port, target.hostname);
  const args = [
    "-u", url,
    ...fixedProviderProxyArgs("nuclei"),
    "-t", NUCLEI_BASELINE_TEMPLATE_PATH,
    "-jsonl",
    "-silent",
    "-nc",
    "-duc",
    "-ni",
    "-nh",
    "-dr",
    "-omit-raw",
    "-omit-template",
    "-rl", "1",
    "-bs", "1",
    "-c", "1",
    "-pc", "1",
    "-timeout", "5",
    "-retries", "0",
    "-severity", minimumSeverity(request.minimumSeverity),
  ];

  return Object.freeze({
    profileId: NUCLEI_EXECUTABLE_PROFILE_ID,
    executable: "nuclei",
    args: Object.freeze(args),
  });
}
