import type {
  NucleiProviderRequest,
  NucleiRunnerRequest,
  NucleiSeverity,
} from "../provider-nuclei";
import {
  NUCLEI_INITIAL_TEMPLATE_ID,
  NUCLEI_INITIAL_TEMPLATE_PATH,
} from "./runtime-config";

export const NUCLEI_EXECUTABLE_PROFILE_ID = "projectdiscovery-nuclei-3.11.1-safe-v1";

export interface NucleiExecutionPlan {
  profileId: typeof NUCLEI_EXECUTABLE_PROFILE_ID;
  executable: "nuclei";
  args: readonly string[];
}

const SEVERITY_ORDER: Readonly<Record<NucleiSeverity, number>> = Object.freeze({
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
});

function targetAuthority(request: Readonly<NucleiProviderRequest>, hostname: string): string {
  if (!/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i.test(hostname) || hostname.length > 253) {
    throw new Error("NUCLEI_TRUSTED_HOSTNAME_INVALID");
  }
  return `https://${hostname.toLowerCase()}:443`;
}

export function buildNucleiExecutionPlan(
  request: Readonly<NucleiRunnerRequest>,
  trustedHostname: string,
): Readonly<NucleiExecutionPlan> {
  if (request.templateProfile !== "baseline-http") {
    throw new Error("NUCLEI_RUNTIME_PROFILE_DISABLED");
  }
  if (request.approvedTemplateIds.length !== 1
      || request.approvedTemplateIds[0] !== NUCLEI_INITIAL_TEMPLATE_ID) {
    throw new Error("NUCLEI_RUNTIME_TEMPLATE_SET_INVALID");
  }
  if (SEVERITY_ORDER[request.minimumSeverity] > SEVERITY_ORDER.info) {
    throw new Error("NUCLEI_RUNTIME_SEVERITY_PROFILE_UNSUPPORTED");
  }

  return Object.freeze({
    profileId: NUCLEI_EXECUTABLE_PROFILE_ID,
    executable: "nuclei",
    args: Object.freeze([
      "-u",
      targetAuthority(request, trustedHostname),
      "-t",
      NUCLEI_INITIAL_TEMPLATE_PATH,
      "-jsonl",
      "-silent",
      "-nc",
      "-duc",
      "-ni",
      "-dc",
      "-rl",
      "1",
      "-bs",
      "1",
      "-c",
      "1",
      "-retries",
      "0",
      "-timeout",
      "5",
    ]),
  });
}
