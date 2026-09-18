import type {
  HttpDiscoveryCapabilityId,
  HttpDiscoveryMethodProfile,
  HttpDiscoveryProfile,
} from "@/packages/runtime-worker-mediator/http-discovery";

const CLOSED_PARAMETER_KEYS = new Set([
  "discoveryProfile",
  "methodProfile",
  "followSameOriginRedirects",
]);
const DISCOVERY_PROFILES = new Set<HttpDiscoveryProfile>(["root-only", "well-known-safe"]);
const METHOD_PROFILES = new Set<HttpDiscoveryMethodProfile>(["GET_ONLY", "HEAD_THEN_GET"]);

export interface Phase11HttpClosedParameters {
  discoveryProfile: HttpDiscoveryProfile;
  methodProfile: HttpDiscoveryMethodProfile;
  followSameOriginRedirects: boolean;
}

export function parsePhase11HttpClosedParameters(
  value: Readonly<Record<string, string | number | boolean>>,
  capabilityId: HttpDiscoveryCapabilityId,
): Readonly<Phase11HttpClosedParameters> {
  const keys = Object.keys(value);
  if (keys.length !== CLOSED_PARAMETER_KEYS.size || keys.some((key) => !CLOSED_PARAMETER_KEYS.has(key))) {
    throw new Error("PHASE11_HTTP_CLOSED_PARAMETERS_INVALID");
  }
  if (typeof value.discoveryProfile !== "string"
      || !DISCOVERY_PROFILES.has(value.discoveryProfile as HttpDiscoveryProfile)) {
    throw new Error("PHASE11_HTTP_DISCOVERY_PROFILE_INVALID");
  }
  if (capabilityId === "web.http.probe.v1" && value.discoveryProfile !== "root-only") {
    throw new Error("PHASE11_HTTP_DISCOVERY_PROFILE_INVALID");
  }
  if (typeof value.methodProfile !== "string"
      || !METHOD_PROFILES.has(value.methodProfile as HttpDiscoveryMethodProfile)) {
    throw new Error("PHASE11_HTTP_METHOD_PROFILE_INVALID");
  }
  if (typeof value.followSameOriginRedirects !== "boolean") {
    throw new Error("PHASE11_HTTP_REDIRECT_POLICY_INVALID");
  }
  return Object.freeze({
    discoveryProfile: value.discoveryProfile as HttpDiscoveryProfile,
    methodProfile: value.methodProfile as HttpDiscoveryMethodProfile,
    followSameOriginRedirects: value.followSameOriginRedirects,
  });
}

export function phase11HttpRequiredRequestCapacity(
  input: Readonly<Phase11HttpClosedParameters>,
): number {
  const routes = input.discoveryProfile === "root-only" ? 1 : 4;
  const perRoute = (input.methodProfile === "HEAD_THEN_GET" ? 2 : 1)
    + (input.followSameOriginRedirects ? 1 : 0);
  return routes * perRoute;
}
