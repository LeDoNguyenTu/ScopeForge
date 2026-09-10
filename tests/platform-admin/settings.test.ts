import { describe, expect, it } from "vitest";
import {
  PlatformSettingsError,
  getPlatformSettings,
  updatePlatformSettings,
  type PlatformSettingsServiceDependencies,
} from "@/lib/platform-settings/server";

function dependencies(overrides: Partial<PlatformSettingsServiceDependencies> = {}): PlatformSettingsServiceDependencies {
  return {
    readSettings: async () => ({
      registrationEnabled: true,
      maintenanceMode: false,
      maintenanceMessage: "Scheduled maintenance",
      updatedAt: "2026-09-10T00:00:00.000Z",
    }),
    authorize: async () => ({ actorUserId: "22222222-2222-4222-8222-222222222222" }),
    persistSettings: async (input) => ({ ...input, updatedAt: "2026-09-10T01:00:00.000Z" }),
    writeAuditEvent: async () => undefined,
    ...overrides,
  };
}

describe("platform settings service", () => {
  it("reads normalized site settings", async () => {
    await expect(getPlatformSettings(dependencies())).resolves.toEqual({
      registrationEnabled: true,
      maintenanceMode: false,
      maintenanceMessage: "Scheduled maintenance",
      updatedAt: "2026-09-10T00:00:00.000Z",
    });
  });

  it("persists bounded settings and writes an audit event", async () => {
    const auditActions: string[] = [];
    const settings = await updatePlatformSettings(
      {
        registrationEnabled: false,
        maintenanceMode: true,
        maintenanceMessage: "Emergency database maintenance",
        reason: "Operational maintenance window",
      },
      dependencies({ writeAuditEvent: async (input) => { auditActions.push(input.action); } }),
    );

    expect(settings.registrationEnabled).toBe(false);
    expect(settings.maintenanceMode).toBe(true);
    expect(auditActions).toEqual(["settings.updated"]);
  });

  it("rejects unbounded messages and reasons", async () => {
    await expect(
      updatePlatformSettings(
        { registrationEnabled: true, maintenanceMode: false, maintenanceMessage: "", reason: "valid" },
        dependencies(),
      ),
    ).rejects.toEqual(expect.objectContaining<Partial<PlatformSettingsError>>({ code: "INVALID_MAINTENANCE_MESSAGE" }));

    await expect(
      updatePlatformSettings(
        { registrationEnabled: true, maintenanceMode: false, maintenanceMessage: "valid", reason: "x".repeat(501) },
        dependencies(),
      ),
    ).rejects.toEqual(expect.objectContaining<Partial<PlatformSettingsError>>({ code: "INVALID_PLATFORM_SETTINGS_REASON" }));
  });

  it("sanitizes provider failures", async () => {
    await expect(
      getPlatformSettings(dependencies({ readSettings: async () => { throw new Error("database secret body"); } })),
    ).rejects.toEqual(
      expect.objectContaining<Partial<PlatformSettingsError>>({
        code: "PLATFORM_SETTINGS_READ_FAILED",
        message: "Unable to load platform settings.",
      }),
    );
  });
});
