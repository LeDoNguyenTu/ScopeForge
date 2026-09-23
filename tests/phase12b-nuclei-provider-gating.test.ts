import { describe, expect, it } from "vitest";
import { createNucleiProvider, type NucleiRawResult, type NucleiRunner } from "../packages/provider-nuclei";
import { NUCLEI_RUNTIME_PROVIDER_CONFIG } from "../packages/nuclei-worker-runner/runtime-config";

function runner(result: NucleiRawResult): NucleiRunner {
  return { run: async () => result };
}

describe("Phase 12B Nuclei runtime profile gating", () => {
  it("keeps non-adopted template profiles disabled instead of inventing placeholder templates", () => {
    const provider = createNucleiProvider(runner({
      capabilityId: "web.template.validate.v1",
      actionId: "action-1",
      targetNodeId: "node-1",
      templateProfile: "baseline-http",
      minimumSeverity: "info",
      matches: [],
    }), NUCLEI_RUNTIME_PROVIDER_CONFIG);

    expect(provider.validateRequest({
      capabilityId: "web.template.validate.v1",
      targetNodeId: "node-1",
      templateProfile: "baseline-http",
      minimumSeverity: "info",
    }, {
      workspaceId: "workspace-1",
      authorizationSnapshotRef: "snapshot-1",
      executionMode: "validation",
    })).toEqual({ ok: true });

    expect(provider.validateRequest({
      capabilityId: "web.template.validate.v1",
      targetNodeId: "node-1",
      templateProfile: "misconfiguration-reviewed",
      minimumSeverity: "info",
    }, {
      workspaceId: "workspace-1",
      authorizationSnapshotRef: "snapshot-1",
      executionMode: "validation",
    })).toEqual({ ok: false, code: "NUCLEI_PROFILE_DISABLED" });

    expect(provider.validateRequest({
      capabilityId: "web.template.validate.v1",
      targetNodeId: "node-1",
      templateProfile: "known-cve-reviewed",
      minimumSeverity: "info",
    }, {
      workspaceId: "workspace-1",
      authorizationSnapshotRef: "snapshot-1",
      executionMode: "validation",
    })).toEqual({ ok: false, code: "NUCLEI_PROFILE_DISABLED" });
  });
});
