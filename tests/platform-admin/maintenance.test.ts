import { describe, expect, it } from "vitest";
import { shouldEnterMaintenance } from "@/lib/platform-settings/server";

describe("platform maintenance boundary", () => {
  it("keeps admin, auth, maintenance and API surfaces reachable", () => {
    for (const pathname of [
      "/admin",
      "/admin/users",
      "/auth/sign-in",
      "/auth/sign-up",
      "/maintenance",
      "/api/internal/workers/claim",
      "/api/health",
    ]) {
      expect(shouldEnterMaintenance({ pathname, maintenanceMode: true, isPlatformAdmin: false })).toBe(false);
    }
  });

  it("blocks ordinary application routes while maintenance is enabled", () => {
    expect(shouldEnterMaintenance({ pathname: "/", maintenanceMode: true, isPlatformAdmin: false })).toBe(true);
    expect(shouldEnterMaintenance({ pathname: "/dashboard", maintenanceMode: true, isPlatformAdmin: false })).toBe(true);
    expect(shouldEnterMaintenance({ pathname: "/dashboard/assets", maintenanceMode: true, isPlatformAdmin: false })).toBe(true);
  });

  it("allows platform administrators to bypass maintenance", () => {
    expect(shouldEnterMaintenance({ pathname: "/dashboard", maintenanceMode: true, isPlatformAdmin: true })).toBe(false);
  });

  it("does not block any route when maintenance is disabled", () => {
    expect(shouldEnterMaintenance({ pathname: "/dashboard", maintenanceMode: false, isPlatformAdmin: false })).toBe(false);
  });
});
