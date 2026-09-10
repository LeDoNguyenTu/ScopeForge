import type { PlatformSettings } from "@/lib/platform-admin/types";

export interface PublicPlatformSettingsDependencies {
  fetcher?: typeof fetch;
  supabaseUrl?: string;
  publishableKey?: string;
}

type PublicPlatformSettingsRow = {
  registration_enabled: boolean;
  maintenance_mode: boolean;
  maintenance_message: string;
  updated_at: string;
};

function isPublicPlatformSettingsRow(value: unknown): value is PublicPlatformSettingsRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.registration_enabled === "boolean"
    && typeof row.maintenance_mode === "boolean"
    && typeof row.maintenance_message === "string"
    && row.maintenance_message.length >= 1
    && row.maintenance_message.length <= 280
    && typeof row.updated_at === "string"
    && Number.isFinite(Date.parse(row.updated_at));
}

export async function readPublicPlatformSettings(
  dependencies: PublicPlatformSettingsDependencies = {},
): Promise<PlatformSettings> {
  const fetcher = dependencies.fetcher ?? fetch;
  const supabaseUrl = (dependencies.supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  const publishableKey = dependencies.publishableKey ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

  if (!supabaseUrl || !publishableKey) {
    throw new Error("Unable to load platform availability settings.");
  }

  const fields = "registration_enabled,maintenance_mode,maintenance_message,updated_at";
  const url = `${supabaseUrl}/rest/v1/platform_settings?id=eq.true&select=${encodeURIComponent(fields)}&limit=1`;

  try {
    const response = await fetcher(url, {
      method: "GET",
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${publishableKey}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) throw new Error("PUBLIC_PLATFORM_SETTINGS_HTTP_FAILED");
    const payload: unknown = await response.json();
    if (!Array.isArray(payload) || payload.length !== 1 || !isPublicPlatformSettingsRow(payload[0])) {
      throw new Error("PUBLIC_PLATFORM_SETTINGS_INVALID");
    }

    return {
      registrationEnabled: payload[0].registration_enabled,
      maintenanceMode: payload[0].maintenance_mode,
      maintenanceMessage: payload[0].maintenance_message,
      updatedAt: payload[0].updated_at,
    };
  } catch {
    throw new Error("Unable to load platform availability settings.");
  }
}
