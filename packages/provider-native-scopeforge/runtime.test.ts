import { describe, expect, it } from "vitest";
import { normalizeActiveCorsObservation, normalizePassiveRuntimeObservations } from "./runtime";

describe("native ScopeForge runtime adapters", () => {
  it("normalizes passive observations without copying URLs or header values", () => {
    const observations = normalizePassiveRuntimeObservations({
      runId: "runtime-run-1",
      assetNodeId: "asset-node-1",
      authorizationSnapshotRef: "authz-snapshot-1",
      observedAt: "2026-09-18T00:00:00.000Z",
      entries: [
        {
          sequence: 1,
          evidenceRefs: ["runtime-evidence-1"],
          observation: {
            kind: "header",
            name: "server",
            present: true,
            value: "SECRET_HEADER_VALUE_SENTINEL",
          },
        },
        {
          sequence: 0,
          evidenceRefs: ["runtime-evidence-0"],
          observation: {
            kind: "http-status",
            url: "https://example.com/private/path?token=SECRET",
            status: 200,
          },
        },
      ],
    });

    expect(observations.map((item) => item.observationId)).toEqual([
      "phase11:runtime-observer:runtime-run-1:asset-node-1:0:http-status",
      "phase11:runtime-observer:runtime-run-1:asset-node-1:1:header",
    ]);
    const serialized = JSON.stringify(observations);
    expect(serialized).not.toContain("SECRET_HEADER_VALUE_SENTINEL");
    expect(serialized).not.toContain("private/path");
    expect(serialized).not.toContain("token=SECRET");
  });

  it("normalizes active CORS validation without copying the target URL", () => {
    const observation = normalizeActiveCorsObservation({
      runId: "active-run-1",
      assetNodeId: "asset-node-1",
      authorizationSnapshotRef: "authz-snapshot-1",
      observedAt: "2026-09-18T00:00:00.000Z",
      evidenceRefs: ["active-runtime-evidence-1"],
      observation: {
        kind: "cors-policy",
        url: "https://example.com/private?token=SECRET",
        status: 200,
        allowedOrigin: "https://scopeforge.invalid",
        credentialsAllowed: true,
        variesOnOrigin: false,
      },
    });

    expect(observation).toMatchObject({
      providerId: "scopeforge.runtime-validator",
      providerVersion: "cors-origin-policy@1",
      capabilityId: "web.cors.validate.v1",
      executionMode: "validation",
      evidenceRefs: ["active-runtime-evidence-1"],
    });
    expect(JSON.stringify(observation)).not.toContain("example.com/private");
    expect(JSON.stringify(observation)).not.toContain("token=SECRET");
  });

  it("requires evidence links and unique non-negative passive sequence numbers", () => {
    expect(() => normalizePassiveRuntimeObservations({
      runId: "runtime-run-1",
      assetNodeId: "asset-node-1",
      authorizationSnapshotRef: "authz-snapshot-1",
      observedAt: "2026-09-18T00:00:00.000Z",
      entries: [{
        sequence: 0,
        evidenceRefs: [],
        observation: { kind: "http-status", url: "https://example.com", status: 200 },
      }],
    })).toThrow("RUNTIME_EVIDENCE_REFERENCE_REQUIRED");

    expect(() => normalizePassiveRuntimeObservations({
      runId: "runtime-run-1",
      assetNodeId: "asset-node-1",
      authorizationSnapshotRef: "authz-snapshot-1",
      observedAt: "2026-09-18T00:00:00.000Z",
      entries: [
        {
          sequence: 0,
          evidenceRefs: ["e-1"],
          observation: { kind: "http-status", url: "https://example.com", status: 200 },
        },
        {
          sequence: 0,
          evidenceRefs: ["e-2"],
          observation: { kind: "tls", protocol: "TLSv1.3", validFrom: null, validTo: null, sanCount: 1, hostnameMatches: true },
        },
      ],
    })).toThrow("RUNTIME_OBSERVATION_SEQUENCE_INVALID");
  });
});
