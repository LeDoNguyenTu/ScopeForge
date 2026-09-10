export type PlatformAdminRole = "owner" | "admin";

export interface PlatformSettings {
  registrationEnabled: boolean;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  updatedAt: string;
}
