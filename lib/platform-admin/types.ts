export type PlatformAdminRole = "owner" | "admin";

export interface PlatformSettings {
  registrationEnabled: boolean;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  maintenanceEndsAt: string | null;
  maintenanceTimeZone: string | null;
  maintenanceAutoDisable: boolean;
  updatedAt: string;
}
