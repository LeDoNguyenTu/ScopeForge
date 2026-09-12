import type { Database as BaseDatabase, Json } from "./database.types";
import type { PlatformAdminRole } from "./platform-admin/types";

export type PlatformAdminTable = {
  Row: {
    user_id: string;
    role: PlatformAdminRole;
    created_by: string;
    created_at: string;
    updated_at: string;
  };
  Insert: {
    user_id: string;
    role: PlatformAdminRole;
    created_by: string;
    created_at?: string;
    updated_at?: string;
  };
  Update: {
    role?: PlatformAdminRole;
    updated_at?: string;
  };
  Relationships: [];
};

export type PlatformAdminAuditEventTable = {
  Row: {
    id: string;
    actor_user_id: string;
    action: string;
    target_user_id: string | null;
    target_workspace_id: string | null;
    reason: string;
    metadata: Json;
    created_at: string;
  };
  Insert: {
    id?: string;
    actor_user_id: string;
    action: string;
    target_user_id?: string | null;
    target_workspace_id?: string | null;
    reason: string;
    metadata?: Json;
    created_at?: string;
  };
  Update: never;
  Relationships: [];
};

export type PlatformSettingsTable = {
  Row: {
    id: boolean;
    registration_enabled: boolean;
    maintenance_mode: boolean;
    maintenance_message: string;
    updated_by: string | null;
    created_at: string;
    updated_at: string;
  };
  Insert: {
    id?: boolean;
    registration_enabled?: boolean;
    maintenance_mode?: boolean;
    maintenance_message?: string;
    updated_by?: string | null;
    created_at?: string;
    updated_at?: string;
  };
  Update: {
    registration_enabled?: boolean;
    maintenance_mode?: boolean;
    maintenance_message?: string;
    updated_by?: string | null;
    updated_at?: string;
  };
  Relationships: [];
};

export type Phase10cDatabase = Omit<BaseDatabase, "public"> & {
  public: Omit<BaseDatabase["public"], "Tables"> & {
    Tables: BaseDatabase["public"]["Tables"] & {
      platform_admins: PlatformAdminTable;
      platform_admin_audit_events: PlatformAdminAuditEventTable;
      platform_settings: PlatformSettingsTable;
    };
  };
};
