import { afterEach, describe, expect, it, vi } from "vitest";
import { writeSecurityTelemetry } from "@/lib/security/telemetry";

afterEach(() => vi.restoreAllMocks());

describe("security telemetry", () => {
  it("writes one bounded warning JSON object for worker authentication rejection", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    writeSecurityTelemetry({
      schema: "scopeforge.security.v1",
      event: "worker.authentication_rejected",
      severity: "warning",
      route: "worker.claim",
      code: "WORKER_AUTHENTICATION_FAILED",
      status: 401,
    });

    expect(warn).toHaveBeenCalledTimes(1);
    const serialized = String(warn.mock.calls[0]?.[0]);
    expect(Buffer.byteLength(serialized, "utf8")).toBeLessThanOrEqual(1024);
    expect(JSON.parse(serialized)).toEqual({
      schema: "scopeforge.security.v1",
      event: "worker.authentication_rejected",
      severity: "warning",
      route: "worker.claim",
      code: "WORKER_AUTHENTICATION_FAILED",
      status: 401,
    });
  });

  it("uses error output for unexpected worker failures", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    writeSecurityTelemetry({
      schema: "scopeforge.security.v1",
      event: "worker.request_failed",
      severity: "error",
      route: "worker.runtime_prepare",
      code: "WORKER_REQUEST_FAILED",
      status: 500,
    });

    expect(error).toHaveBeenCalledTimes(1);
  });

  it("supports the bounded security-control misconfiguration event", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    writeSecurityTelemetry({
      schema: "scopeforge.security.v1",
      event: "security.control_misconfigured",
      severity: "error",
      route: "security.config",
      control: "turnstile.provider",
    });

    expect(error).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(error.mock.calls[0]?.[0]))).toEqual({
      schema: "scopeforge.security.v1",
      event: "security.control_misconfigured",
      severity: "error",
      route: "security.config",
      control: "turnstile.provider",
    });
  });

  it("silently drops runtime-invalid input without secondary logging", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    writeSecurityTelemetry({
      schema: "scopeforge.security.v1",
      event: "worker.authentication_rejected",
      severity: "warning",
      route: "worker.claim",
      code: "X".repeat(200),
      status: 401,
    } as never);

    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it("drops caller-supplied extra fields instead of serializing them", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    writeSecurityTelemetry({
      schema: "scopeforge.security.v1",
      event: "worker.authentication_rejected",
      severity: "warning",
      route: "worker.claim",
      code: "WORKER_AUTHENTICATION_FAILED",
      status: 401,
      authorization: "Bearer must-not-appear",
    } as never);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).not.toContain("must-not-appear");
    expect(JSON.parse(String(warn.mock.calls[0]?.[0]))).toEqual({
      schema: "scopeforge.security.v1",
      event: "worker.authentication_rejected",
      severity: "warning",
      route: "worker.claim",
      code: "WORKER_AUTHENTICATION_FAILED",
      status: 401,
    });
  });
});
