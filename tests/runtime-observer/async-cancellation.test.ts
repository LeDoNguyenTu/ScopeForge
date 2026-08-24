import { describe, expect, it, vi } from "vitest";
import { assetRef } from "@/packages/security-domain";
import {
  observeRuntimeTarget,
  type AuthorizedRuntimeTarget,
  type RuntimeObservationBudget,
  type RuntimeTransportResponse,
} from "@/packages/runtime-observer";

const target: AuthorizedRuntimeTarget = {
  assetRef: assetRef("asset-1"),
  kind: "web_application",
  canonicalUrl: "https://example.com/start",
  hostname: "example.com",
};

const budget: RuntimeObservationBudget = {
  maxRequests: 4,
  maxRedirects: 3,
  perRequestTimeoutMs: 5_000,
  totalTimeoutMs: 15_000,
  maxObservationBytes: 65_536,
};

function redirectResponse(): RuntimeTransportResponse {
  return {
    status: 302,
    headers: { location: "/next" },
    tls: {
      protocol: "TLSv1.3",
      validFrom: "Jan 01 00:00:00 2026 GMT",
      validTo: "Jan 01 00:00:00 2027 GMT",
      subjectAltName: "DNS:example.com",
    },
  };
}

describe("runtime observer async cancellation boundary", () => {
  it("awaits cancellation state after response headers and before following a redirect", async () => {
    const transport = vi.fn(async () => redirectResponse());
    let cancellationChecks = 0;

    const result = await observeRuntimeTarget(target, budget, {
      transport,
      isCancelled: async () => {
        cancellationChecks += 1;
        return cancellationChecks >= 2;
      },
    });

    expect(result.status).toBe("cancelled");
    expect(result.requestCount).toBe(1);
    expect(transport).toHaveBeenCalledTimes(1);
    expect(cancellationChecks).toBeGreaterThanOrEqual(2);
  });
});
