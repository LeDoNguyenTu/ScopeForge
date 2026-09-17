import { describe, expect, it } from "vitest";
import {
  makeActionAuthorization,
  makeActionIntent,
  makeCapabilityDescriptor,
  makeObservation,
} from "./types";

const NOW = new Date("2026-09-18T00:00:00.000Z");

describe("Phase 11 planning domain contracts", () => {
  it("constructs a closed capability descriptor with safe defaults", () => {
    const result = makeCapabilityDescriptor({
      capabilityId: "network.port.discover.v1",
      mode: "passive",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      capabilityId: "network.port.discover.v1",
      version: "1.0.0",
      mode: "passive",
      maxRequestBudget: 1,
      maxRuntimeMs: 30_000,
      stateMutationClass: "none",
      cleanupRequired: false,
    });
  });

  it.each([
    { providerNativeArgs: ["-A"] },
    { command: "nmap" },
    { argv: ["--script", "unsafe"] },
    { url: "https://target.invalid/admin" },
    { headers: { authorization: "secret" } },
    { javascript: "fetch('/admin')" },
  ])("rejects planner-visible executable/provider-native authority: %j", (extra) => {
    const result = makeActionIntent({
      actionId: "action-1",
      hypothesisId: "hypothesis-1",
      capabilityId: "network.port.discover.v1",
      targetNodeIds: ["node-1"],
      requestedMode: "safe_active",
      closedParameters: { requestLimit: 5 },
      expectedEvidenceTypes: ["network.port"],
      ...extra,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("UNKNOWN_FIELD");
  });

  it("accepts only primitive closed action parameters", () => {
    expect(makeActionIntent({
      actionId: "action-1",
      hypothesisId: "hypothesis-1",
      capabilityId: "web.http.probe.v1",
      targetNodeIds: ["node-1"],
      requestedMode: "safe_active",
      closedParameters: { requestLimit: 3, followRedirects: false, profile: "headers_only" },
      expectedEvidenceTypes: ["http.response.metadata"],
    }).ok).toBe(true);

    expect(makeActionIntent({
      actionId: "action-2",
      hypothesisId: "hypothesis-1",
      capabilityId: "web.http.probe.v1",
      targetNodeIds: ["node-1"],
      requestedMode: "safe_active",
      closedParameters: { nested: { arbitrary: "payload" } },
      expectedEvidenceTypes: ["http.response.metadata"],
    }).ok).toBe(false);
  });

  it("rejects expired authorization before execution", () => {
    const result = makeActionAuthorization({
      authorizationId: "authz-1",
      actionId: "action-1",
      workspaceId: "workspace-1",
      targetNodeIds: ["node-1"],
      authorizationSnapshotRef: "snapshot-1",
      capabilityId: "web.http.probe.v1",
      capabilityVersion: "1.0.0",
      executionMode: "safe_active",
      maxRequests: 3,
      maxRuntimeMs: 10_000,
      expiresAt: "2026-09-17T23:59:59.000Z",
      cancellationKey: "cancel-1",
    }, NOW);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("AUTHORIZATION_EXPIRED");
  });

  it("accepts a future bounded authorization", () => {
    const result = makeActionAuthorization({
      authorizationId: "authz-1",
      actionId: "action-1",
      workspaceId: "workspace-1",
      targetNodeIds: ["node-1"],
      authorizationSnapshotRef: "snapshot-1",
      capabilityId: "web.http.probe.v1",
      capabilityVersion: "1.0.0",
      executionMode: "safe_active",
      maxRequests: 3,
      maxRuntimeMs: 10_000,
      expiresAt: "2026-09-18T00:05:00.000Z",
      cancellationKey: "cancel-1",
    }, NOW);

    expect(result.ok).toBe(true);
  });

  it("requires immutable evidence references for normalized observations", () => {
    const base = {
      observationId: "observation-1",
      runId: "run-1",
      providerId: "scopeforge.runtime",
      providerVersion: "1.0.0",
      capabilityId: "web.http.observe.v1",
      assetNodeIds: ["node-1"],
      facts: { status: 200, tls: true },
      observedAt: "2026-09-18T00:00:00.000Z",
      confidence: 0.9,
      authorizationSnapshotRef: "snapshot-1",
      executionMode: "passive",
    } as const;

    expect(makeObservation({ ...base, evidenceRefs: [] }).ok).toBe(false);
    expect(makeObservation({ ...base, evidenceRefs: ["evidence-1"] }).ok).toBe(true);
  });

  it("rejects non-normalized observation facts and invalid confidence", () => {
    expect(makeObservation({
      observationId: "observation-1",
      runId: "run-1",
      providerId: "scopeforge.runtime",
      providerVersion: "1.0.0",
      capabilityId: "web.http.observe.v1",
      assetNodeIds: ["node-1"],
      evidenceRefs: ["evidence-1"],
      facts: { response: { raw: "not allowed" } },
      observedAt: "2026-09-18T00:00:00.000Z",
      confidence: 0.9,
      authorizationSnapshotRef: "snapshot-1",
      executionMode: "passive",
    }).ok).toBe(false);

    expect(makeObservation({
      observationId: "observation-1",
      runId: "run-1",
      providerId: "scopeforge.runtime",
      providerVersion: "1.0.0",
      capabilityId: "web.http.observe.v1",
      assetNodeIds: ["node-1"],
      evidenceRefs: ["evidence-1"],
      facts: { status: 200 },
      observedAt: "2026-09-18T00:00:00.000Z",
      confidence: 1.1,
      authorizationSnapshotRef: "snapshot-1",
      executionMode: "passive",
    }).ok).toBe(false);
  });
});
