import type { NucleiProviderConfig } from "../provider-nuclei";

export const NUCLEI_TEMPLATE_RELEASE = "v10.4.9";
export const NUCLEI_TEMPLATE_COMMIT = "893122ffce8ebf8e264f15d2cd3960cb1dd36d6c";
export const NUCLEI_INITIAL_TEMPLATE_ID = "csp-script-src-wildcard";
export const NUCLEI_INITIAL_TEMPLATE_PATH =
  "/opt/scopeforge/templates/csp-script-src-wildcard.yaml";

export const NUCLEI_RUNTIME_PROVIDER_CONFIG: Readonly<NucleiProviderConfig> = Object.freeze({
  profiles: Object.freeze({
    "baseline-http": Object.freeze([NUCLEI_INITIAL_TEMPLATE_ID]),
    "misconfiguration-reviewed": Object.freeze([]),
    "known-cve-reviewed": Object.freeze([]),
  }),
});
