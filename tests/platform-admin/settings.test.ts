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
      maintenanceEndsAt: null,
      maintenanceTimeZone: null,
      maintenanceAutoDisable: true,
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
      maintenanceEndsAt: null,
      maintenanceTimeZone: null,
      maintenanceAutoDisable: true,
      updatedAt: "2026-09-10T00:00:00.000Z",
    });
  });

  it("records settings intent before persistence and completion afterward", async () => {
    const order: string[] = [];
    const settings = await updatePlatformSettings(
      {
        registrationEnabled: false,
        maintenanceMode: true,
        maintenanceMessage: "Emergency database maintenance",
        maintenanceEndsAt: "2027-09-10T03:00:00.000Z",
        maintenanceTimeZone: "Asia/Singapore",
        maintenanceAutoDisable: true,
        reason: "Operational maintenance window",
      },
      dependencies({
        writeAuditEvent: async (input) => { order.push(`audit:${input.action}`); },
        persistSettings: async (input) => {
          order.push("settings:persisted");
          return { ...input, updatedAt: "2026-09-10T01:00:00.000Z" };
        },
      }),
    );

    expect(settings.registrationEnabled).toBe(false);
    expect(settings.maintenanceMode).toBe(true);
    expect(order).toEqual([
      "audit:settings.update_started",
      "settings:persisted",
      "audit:settings.updated",
    ]);
  });

  it("records an attempted settings mutation when provider persistence fails", async () => {
    const auditActions: string[] = [];
    await expect(updatePlatformSettings(
      {
        registrationEnabled: false,
        maintenanceMode: true,
        maintenanceMessage: "Emergency database maintenance",
        maintenanceEndsAt: "2027-09-10T03:00:00.000Z",
        maintenanceTimeZone: "Asia/Singapore",
        maintenanceAutoDisable: true,
        reason: "Operational maintenance window",
      },
      dependencies({
        writeAuditEvent: async (input) => { auditActions.push(input.action); },
        persistSettings: async () => { throw new Error("provider-secret-body"); },
      }),
    )).rejects.toEqual(expect.objectContaining<Partial<PlatformSettingsError>>({
      code: "PLATFORM_SETTINGS_UPDATE_FAILED",
      message: "The platform settings could not be updated safely.",
    }));
    expect(auditActions).toEqual(["settings.update_started"]);
  });

  it("rejects unbounded messages and reasons", async () => {
    await expect(
      updatePlatformSettings(
        { registrationEnabled: true, maintenanceMode: false, maintenanceMessage: "", maintenanceEndsAt: null, maintenanceTimeZone: null, maintenanceAutoDisable: true, reason: "valid" },
        dependencies(),
      ),
    ).rejects.toEqual(expect.objectContaining<Partial<PlatformSettingsError>>({ code: "INVALID_MAINTENANCE_MESSAGE" }));

    await expect(
      updatePlatformSettings(
        { registrationEnabled: true, maintenanceMode: false, maintenanceMessage: "valid", maintenanceEndsAt: null, maintenanceTimeZone: null, maintenanceAutoDisable: true, reason: "x".repeat(501) },
        dependencies(),
      ),
    ).rejects.toEqual(expect.objectContaining<Partial<PlatformSettingsError>>({ code: "INVALID_PLATFORM_SETTINGS_REASON" }));
  });

  it("requires a completion estimate for active maintenance and validates the display timezone", async () => {
    await expect(updatePlatformSettings({
      registrationEnabled: true,
      maintenanceMode: true,
      maintenanceMessage: "Scheduled maintenance",
      maintenanceEndsAt: null,
      maintenanceTimeZone: null,
      maintenanceAutoDisable: true,
      reason: "Planned work",
    }, dependencies())).rejects.toEqual(expect.objectContaining<Partial<PlatformSettingsError>>({
      code: "INVALID_MAINTENANCE_WINDOW",
    }));

    await expect(updatePlatformSettings({
      registrationEnabled: true,
      maintenanceMode: true,
      maintenanceMessage: "Scheduled maintenance",
      maintenanceEndsAt: "2027-09-10T03:00:00.000Z",
      maintenanceTimeZone: "Not/A_Timezone",
      maintenanceAutoDisable: false,
      reason: "Planned work",
    }, dependencies())).rejects.toEqual(expect.objectContaining<Partial<PlatformSettingsError>>({
      code: "INVALID_MAINTENANCE_TIME_ZONE",
    }));
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
