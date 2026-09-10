import { redirect } from "next/navigation";
import type { Phase10cDatabase } from "@/lib/database.phase10c.types";
import { PlatformAdminAuthorizationError, requirePlatformAdmin } from "@/lib/platform-admin/authorization";
import type { PlatformSettings } from "@/lib/platform-admin/types";
import { createAdminClient } from "@/lib/supabase/admin";

export type PlatformSettingsErrorCode =
  | "INVALID_MAINTENANCE_MESSAGE"
  | "INVALID_PLATFORM_SETTINGS_REASON"
  | "PLATFORM_SETTINGS_READ_FAILED"
  | "PLATFORM_SETTINGS_UPDATE_FAILED";

export class PlatformSettingsError extends Error {
  constructor(public readonly code: PlatformSettingsErrorCode, message: string) {
    super(message);
    this.name = "PlatformSettingsError";
  }
}

export interface PlatformSettingsUpdateInput {
  registrationEnabled: boolean;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  reason: string;
}

export interface PlatformSettingsServiceDependencies {
  readSettings(): Promise<PlatformSettings>;
  authorize(): Promise<{ actorUserId: string }>;
  persistSettings(input: Omit<PlatformSettingsUpdateInput, "reason">, actorUserId?: string): Promise<PlatformSettings>;
  writeAuditEvent(input: {
    actorUserId: string;
    action: string;
    reason: string;
    metadata: Record<string, string | number | boolean | null>;
  }): Promise<void>;
}

function normalizeMessage(value: string): string {
  const message = value.trim();
  if (message.length < 1 || message.length > 280) {
    throw new PlatformSettingsError(
      "INVALID_MAINTENANCE_MESSAGE",
      "Maintenance messages must contain 1 to 280 characters.",
    );
  }
  return message;
}

function normalizeReason(value: string): string {
  const reason = value.trim();
  if (reason.length < 1 || reason.length > 500) {
    throw new PlatformSettingsError(
      "INVALID_PLATFORM_SETTINGS_REASON",
      "Administrative reasons must contain 1 to 500 characters.",
    );
  }
  return reason;
}

function createDefaultDependencies(): PlatformSettingsServiceDependencies {
  const admin = createAdminClient<Phase10cDatabase>();

  return {
    readSettings: async () => {
      const { data, error } = await admin
        .from("platform_settings")
        .select("registration_enabled,maintenance_mode,maintenance_message,updated_at")
        .eq("id", true)
        .single();
      if (error || !data) throw new Error("PLATFORM_SETTINGS_QUERY_FAILED");
      return {
        registrationEnabled: data.registration_enabled,
        maintenanceMode: data.maintenance_mode,
        maintenanceMessage: data.maintenance_message,
        updatedAt: data.updated_at,
      };
    },
    authorize: async () => {
      const context = await requirePlatformAdmin();
      return { actorUserId: context.user.id };
    },
    persistSettings: async (input, actorUserId) => {
      const { data, error } = await admin
        .from("platform_settings")
        .update({
          registration_enabled: input.registrationEnabled,
          maintenance_mode: input.maintenanceMode,
          maintenance_message: input.maintenanceMessage,
          updated_by: actorUserId ?? null,
        })
        .eq("id", true)
        .select("registration_enabled,maintenance_mode,maintenance_message,updated_at")
        .single();
      if (error || !data) throw new Error("PLATFORM_SETTINGS_UPDATE_FAILED");
      return {
        registrationEnabled: data.registration_enabled,
        maintenanceMode: data.maintenance_mode,
        maintenanceMessage: data.maintenance_message,
        updatedAt: data.updated_at,
      };
    },
    writeAuditEvent: async (input) => {
      const { error } = await admin.from("platform_admin_audit_events").insert({
        actor_user_id: input.actorUserId,
        action: input.action,
        target_user_id: null,
        target_workspace_id: null,
        reason: input.reason,
        metadata: input.metadata,
      });
      if (error) throw new Error("PLATFORM_SETTINGS_AUDIT_FAILED");
    },
  };
}

export function shouldEnterMaintenance(input: {
  pathname: string;
  maintenanceMode: boolean;
  isPlatformAdmin: boolean;
}): boolean {
  if (!input.maintenanceMode || input.isPlatformAdmin) return false;
  const pathname = input.pathname.startsWith("/") ? input.pathname : `/${input.pathname}`;
  const bypass = ["/admin", "/auth", "/maintenance", "/api"];
  return !bypass.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function getPlatformSettings(
  dependencies?: PlatformSettingsServiceDependencies,
): Promise<PlatformSettings> {
  const deps = dependencies ?? createDefaultDependencies();
  try {
    return await deps.readSettings();
  } catch (error) {
    if (error instanceof PlatformSettingsError) throw error;
    throw new PlatformSettingsError("PLATFORM_SETTINGS_READ_FAILED", "Unable to load platform settings.");
  }
}

export async function updatePlatformSettings(
  input: PlatformSettingsUpdateInput,
  dependencies?: PlatformSettingsServiceDependencies,
): Promise<PlatformSettings> {
  const deps = dependencies ?? createDefaultDependencies();
  const message = normalizeMessage(input.maintenanceMessage);
  const reason = normalizeReason(input.reason);
  const actor = await deps.authorize();

  try {
    const settings = await deps.persistSettings(
      {
        registrationEnabled: input.registrationEnabled,
        maintenanceMode: input.maintenanceMode,
        maintenanceMessage: message,
      },
      actor.actorUserId,
    );
    await deps.writeAuditEvent({
      actorUserId: actor.actorUserId,
      action: "settings.updated",
      reason,
      metadata: {
        registrationEnabled: settings.registrationEnabled,
        maintenanceMode: settings.maintenanceMode,
        maintenanceMessageLength: settings.maintenanceMessage.length,
      },
    });
    return settings;
  } catch (error) {
    if (error instanceof PlatformSettingsError || error instanceof PlatformAdminAuthorizationError) throw error;
    throw new PlatformSettingsError(
      "PLATFORM_SETTINGS_UPDATE_FAILED",
      "The platform settings could not be updated safely.",
    );
  }
}

export async function enforcePlatformMaintenanceForUser(
  userId: string,
  pathname = "/dashboard",
): Promise<void> {
  const settings = await getPlatformSettings();
  if (!settings.maintenanceMode) return;

  const admin = createAdminClient<Phase10cDatabase>();
  const { data, error } = await admin
    .from("platform_admins")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new PlatformSettingsError("PLATFORM_SETTINGS_READ_FAILED", "Unable to load platform settings.");

  if (shouldEnterMaintenance({
    pathname,
    maintenanceMode: settings.maintenanceMode,
    isPlatformAdmin: Boolean(data),
  })) {
    redirect("/maintenance");
  }
}
