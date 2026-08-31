import { describe, expect, it, vi } from "vitest";
import type { AssetRef } from "@/packages/security-domain";
import {
  RUNTIME_OBSERVATION_MAX_BUDGET,
  observeRuntimeTarget,
  type AuthorizedRuntimeTarget,
} from "@/packages/runtime-observer";
import {
  ACTIVE_VALIDATION_MAX_BUDGET,
  validateCorsOriginPolicy,
  type AuthorizedValidationTarget,
} from "@/packages/runtime-validator";
import type { TrustedRuntimeRequestPlan } from "@/packages/runtime-network";

const passiveTarget: AuthorizedRuntimeTarget = {
  assetRef: "asset:runtime-cancellation-passive" as AssetRef,
  kind: "web_application",
  canonicalUrl: "https://example.com/app",
  hostname: "example.com",
};

const activeTarget: AuthorizedValidationTarget = {
  assetRef: "asset:runtime-cancellation-active" as AssetRef,
  kind: "web_application",
  canonicalUrl: "https://example.com/app",
  hostname: "example.com",
};

function abortingRequest(signal: AbortSignal | undefined): Promise<never> {
  return new Promise((_resolve, reject) => {
    if (!signal) {
      reject(new Error("runtime transport did not receive the trusted cancellation signal"));
      return;
    }
    if (signal.aborted) {
      reject(new DOMException("cancelled", "AbortError"));
      return;
    }
    signal.addEventListener("abort", () => {
      reject(new DOMException("cancelled", "AbortError"));
    }, { once: true });
  });
}

describe("Phase 6D in-flight network cancellation", () => {
  it("propagates the supervisor signal through the passive transport and classifies abort as cancelled", async () => {
    const controller = new AbortController();
    const transport = vi.fn((input: {
      url: URL;
      timeoutMs: number;
      signal?: AbortSignal;
    }) => abortingRequest(input.signal));

    const pending = observeRuntimeTarget(passiveTarget, RUNTIME_OBSERVATION_MAX_BUDGET, {
      transport,
      signal: controller.signal,
    });
    await Promise.resolve();
    controller.abort();

    await expect(pending).resolves.toMatchObject({
      status: "cancelled",
      requestCount: 0,
      redirectCount: 0,
    });
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("propagates the supervisor signal through active CORS transport and classifies abort as cancelled", async () => {
    const controller = new AbortController();
    const transport = vi.fn((
      _plan: TrustedRuntimeRequestPlan,
      options?: Readonly<{ signal?: AbortSignal }>,
    ) => abortingRequest(options?.signal));

    const pending = validateCorsOriginPolicy(activeTarget, ACTIVE_VALIDATION_MAX_BUDGET, {
      transport,
      signal: controller.signal,
    });
    await Promise.resolve();
    controller.abort();

    await expect(pending).resolves.toEqual({
      status: "cancelled",
      requestCount: 0,
    });
    expect(transport).toHaveBeenCalledTimes(1);
  });
});
