import {
  makeCapabilityDescriptor,
  type CapabilityDescriptor,
} from "@/packages/security-planning";

const canaryResult = makeCapabilityDescriptor({
  capabilityId: "web.http.probe.v1",
  version: "1.0.0",
  supportedAssetTypes: ["http_service", "api"],
  requiredObservationTypes: [],
  mode: "safe_active",
  expectedEffects: ["root_response_observed"],
  evidenceTypes: ["http.response.metadata"],
  maxRequestBudget: 1,
  maxRuntimeMs: 5_000,
  stateMutationClass: "none",
  credentialClasses: [],
  sessionClasses: [],
  cleanupRequired: false,
  providerIds: ["scopeforge.http-discovery"],
  closedParameters: {
    discoveryProfile: "root-only",
    methodProfile: "GET_ONLY",
    followSameOriginRedirects: false,
  },
});
if (!canaryResult.ok) throw new Error(canaryResult.error.message);

export const HTTP_CANARY_CAPABILITY: CapabilityDescriptor = canaryResult.value;
export const PHASE11_HTTP_CAPABILITIES = Object.freeze([HTTP_CANARY_CAPABILITY]);
