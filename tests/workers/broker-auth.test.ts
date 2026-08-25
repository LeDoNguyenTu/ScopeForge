import { describe, expect, it, vi } from "vitest";
import {
  authenticateWorkerRequest,
  WorkerBrokerAuthError,
} from "@/lib/worker-control/auth";

function request(headers: Record<string, string> = {}): Request {
  return new Request("https://scopeforge.dev/api/internal/workers/claim", { method: "POST", headers });
}

describe("worker broker authentication", () => {
  it("requires a worker id and exact bearer secret", async () => {
    const authenticate = vi.fn();
    await expect(authenticateWorkerRequest(request(), { authenticate })).rejects.toBeInstanceOf(WorkerBrokerAuthError);
    await expect(authenticateWorkerRequest(request({
      authorization: "Bearer not-hex",
      "x-scopeforge-worker-id": "11111111-1111-4111-8111-111111111111",
    }), { authenticate })).rejects.toBeInstanceOf(WorkerBrokerAuthError);
    expect(authenticate).not.toHaveBeenCalled();
  });

  it("authenticates through the trusted worker service and never through user cookies", async () => {
    const authenticate = vi.fn(async () => ({
      workerId: "11111111-1111-4111-8111-111111111111",
      executionClass: "foundation_no_egress_v1" as const,
      softwareVersion: "0.1.0",
    }));
    const secret = "a".repeat(64);
    const result = await authenticateWorkerRequest(request({
      authorization: `Bearer ${secret}`,
      "x-scopeforge-worker-id": "11111111-1111-4111-8111-111111111111",
      cookie: "sb-access-token=user-session",
    }), { authenticate });

    expect(result.workerId).toBe("11111111-1111-4111-8111-111111111111");
    expect(authenticate).toHaveBeenCalledWith({
      workerId: "11111111-1111-4111-8111-111111111111",
      secret,
    });
  });

  it("rejects oversized authorization headers before service authentication", async () => {
    const authenticate = vi.fn();
    await expect(authenticateWorkerRequest(request({
      authorization: `Bearer ${"a".repeat(300)}`,
      "x-scopeforge-worker-id": "11111111-1111-4111-8111-111111111111",
    }), { authenticate })).rejects.toMatchObject({ code: "WORKER_AUTHENTICATION_FAILED" });
    expect(authenticate).not.toHaveBeenCalled();
  });
});
