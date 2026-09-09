import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkerBrokerAuthError } from "@/lib/worker-control/auth";
import { workerRouteError } from "@/lib/worker-control/http-response";
import { WorkerControlError } from "@/lib/worker-control/types";

afterEach(() => vi.restoreAllMocks());

async function responseBody(response: Response) {
  return response.json() as Promise<{ error: { code: string } }>;
}

describe("worker route security telemetry", () => {
  it("logs bounded authentication rejection without changing the 401 response", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const response = workerRouteError(new WorkerBrokerAuthError(), "worker.claim");

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await responseBody(response)).toEqual({ error: { code: "WORKER_AUTHENTICATION_FAILED" } });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(warn.mock.calls[0]?.[0]))).toMatchObject({
      schema: "scopeforge.security.v1",
      event: "worker.authentication_rejected",
      severity: "warning",
      route: "worker.claim",
      code: "WORKER_AUTHENTICATION_FAILED",
      status: 401,
    });
  });

  it.each([
    "RUNTIME_WORKER_ACCESS_DENIED",
    "WORKER_DISABLED",
    "WORKER_NOT_AVAILABLE",
  ] as const)("logs access rejection for %s without changing the 403 response", async (code) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const response = workerRouteError(new WorkerControlError(code), "worker.runtime_prepare");

    expect(response.status).toBe(403);
    expect(await responseBody(response)).toEqual({ error: { code } });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(warn.mock.calls[0]?.[0]))).toMatchObject({
      event: "worker.access_rejected",
      route: "worker.runtime_prepare",
      code,
      status: 403,
    });
  });

  it("logs active-limit throttling without changing the 429 response", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const response = workerRouteError(new WorkerControlError("RUNTIME_WORKER_ACTIVE_LIMIT"), "worker.runtime_prepare");

    expect(response.status).toBe(429);
    expect(await responseBody(response)).toEqual({ error: { code: "RUNTIME_WORKER_ACTIVE_LIMIT" } });
    expect(JSON.parse(String(warn.mock.calls[0]?.[0]))).toMatchObject({
      event: "worker.rate_limited",
      route: "worker.runtime_prepare",
      status: 429,
    });
  });

  it.each([
    ["WORKER_VERSION_INVALID", 400],
    ["WORKER_TERMINAL_CONFLICT", 409],
  ] as const)("does not log normal protocol/state error %s", async (code, status) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = workerRouteError(new WorkerControlError(code), "worker.finalize");

    expect(response.status).toBe(status);
    expect(await responseBody(response)).toEqual({ error: { code } });
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it("logs an unexpected failure without serializing the raw error", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = workerRouteError(new Error("must never be serialized"), "worker.runtime_finalize");

    expect(response.status).toBe(500);
    expect(await responseBody(response)).toEqual({ error: { code: "WORKER_REQUEST_FAILED" } });
    expect(errorLog).toHaveBeenCalledTimes(1);
    const serialized = String(errorLog.mock.calls[0]?.[0]);
    expect(serialized).not.toContain("must never be serialized");
    expect(JSON.parse(serialized)).toMatchObject({
      event: "worker.request_failed",
      severity: "error",
      route: "worker.runtime_finalize",
      code: "WORKER_REQUEST_FAILED",
      status: 500,
    });
  });
});
