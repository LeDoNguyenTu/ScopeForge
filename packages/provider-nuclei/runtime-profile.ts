import type { NucleiProviderConfig } from ".";

export const NUCLEI_ENGINE_COMMIT = "a8c88feb4a1c8e961b7902534ce3af97e9d524a4";
export const NUCLEI_TEMPLATES_RELEASE = "v10.4.7";
export const NUCLEI_TEMPLATES_COMMIT = "83234ce456da3e90dda86dfbc5e605e64a846df3";

export const NUCLEI_BASELINE_TEMPLATE_ID = "http-missing-security-headers";
export const NUCLEI_BASELINE_TEMPLATE_PATH =
  "/opt/scopeforge/templates/http-missing-security-headers.yaml";

export const NUCLEI_RUNTIME_PROFILES: NucleiProviderConfig = Object.freeze({
  profiles: Object.freeze({
    "baseline-http": Object.freeze([NUCLEI_BASELINE_TEMPLATE_ID]),
    "misconfiguration-reviewed": Object.freeze([]),
    "known-cve-reviewed": Object.freeze([]),
  }),
});
