export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";
export type AssetKind = "web_application" | "api" | "repository";
export type AssetVerificationStatus = "unverified" | "pending" | "verified" | "failed";
export type ScanJobStatus = "queued" | "running" | "succeeded" | "failed" | "blocked" | "cancelled";
export type ScanJobKind = "phase2_blocked" | "passive_runtime" | "active_validation";
export type AuditActorType = "user" | "system";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; display_name: string | null; avatar_url: string | null; created_at: string; updated_at: string };
        Insert: { id: string; display_name?: string | null; avatar_url?: string | null; created_at?: string; updated_at?: string };
        Update: { id?: string; display_name?: string | null; avatar_url?: string | null; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      workspaces: {
        Row: { id: string; name: string; slug: string; created_by: string; created_at: string; updated_at: string };
        Insert: { id?: string; name: string; slug: string; created_by: string; created_at?: string; updated_at?: string };
        Update: { id?: string; name?: string; slug?: string; created_by?: string; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      workspace_members: {
        Row: { workspace_id: string; user_id: string; role: WorkspaceRole; joined_at: string };
        Insert: { workspace_id: string; user_id: string; role?: WorkspaceRole; joined_at?: string };
        Update: { workspace_id?: string; user_id?: string; role?: WorkspaceRole; joined_at?: string };
        Relationships: [{ foreignKeyName: "workspace_members_workspace_id_fkey"; columns: ["workspace_id"]; isOneToOne: false; referencedRelation: "workspaces"; referencedColumns: ["id"] }];
      };
      assets: {
        Row: { id: string; workspace_id: string; kind: AssetKind; name: string; canonical_target: string; hostname: string | null; verification_status: AssetVerificationStatus; verified_at: string | null; verified_by: string | null; created_by: string; created_at: string; updated_at: string };
        Insert: { id?: string; workspace_id: string; kind: AssetKind; name: string; canonical_target: string; hostname?: string | null; verification_status?: AssetVerificationStatus; verified_at?: string | null; verified_by?: string | null; created_by: string; created_at?: string; updated_at?: string };
        Update: { id?: string; workspace_id?: string; kind?: AssetKind; name?: string; canonical_target?: string; hostname?: string | null; verification_status?: AssetVerificationStatus; verified_at?: string | null; verified_by?: string | null; created_by?: string; created_at?: string; updated_at?: string };
        Relationships: [{ foreignKeyName: "assets_workspace_id_fkey"; columns: ["workspace_id"]; isOneToOne: false; referencedRelation: "workspaces"; referencedColumns: ["id"] }];
      };
      asset_verification_challenges: {
        Row: { id: string; workspace_id: string; asset_id: string; method: string; token_hash: string; expires_at: string; attempt_count: number; last_attempt_at: string | null; revoked_at: string | null; created_by: string; created_at: string };
        Insert: { id?: string; workspace_id: string; asset_id: string; method: string; token_hash: string; expires_at: string; attempt_count?: number; last_attempt_at?: string | null; revoked_at?: string | null; created_by: string; created_at?: string };
        Update: { id?: string; workspace_id?: string; asset_id?: string; method?: string; token_hash?: string; expires_at?: string; attempt_count?: number; last_attempt_at?: string | null; revoked_at?: string | null; created_by?: string; created_at?: string };
        Relationships: [
          { foreignKeyName: "asset_verification_challenges_asset_workspace_fkey"; columns: ["asset_id", "workspace_id"]; isOneToOne: false; referencedRelation: "assets"; referencedColumns: ["id", "workspace_id"] },
          { foreignKeyName: "asset_verification_challenges_workspace_id_fkey"; columns: ["workspace_id"]; isOneToOne: false; referencedRelation: "workspaces"; referencedColumns: ["id"] }
        ];
      };
      scan_jobs: {
        Row: {
          id: string;
          workspace_id: string;
          asset_id: string;
          job_kind: ScanJobKind;
          status: ScanJobStatus;
          requested_by: string;
          blocked_reason: string | null;
          authorization_canonical_target: string | null;
          authorization_asset_kind: AssetKind | null;
          authorization_verified_at: string | null;
          validation_profile_id: string | null;
          validation_profile_version: number | null;
          authorization_granted_at: string | null;
          budget: Json;
          cancel_requested_at: string | null;
          started_at: string | null;
          finished_at: string | null;
          failure_code: string | null;
          request_count: number;
          redirect_count: number;
          finding_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          asset_id: string;
          job_kind?: ScanJobKind;
          status?: ScanJobStatus;
          requested_by: string;
          blocked_reason?: string | null;
          authorization_canonical_target?: string | null;
          authorization_asset_kind?: AssetKind | null;
          authorization_verified_at?: string | null;
          validation_profile_id?: string | null;
          validation_profile_version?: number | null;
          authorization_granted_at?: string | null;
          budget?: Json;
          cancel_requested_at?: string | null;
          started_at?: string | null;
          finished_at?: string | null;
          failure_code?: string | null;
          request_count?: number;
          redirect_count?: number;
          finding_count?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          asset_id?: string;
          job_kind?: ScanJobKind;
          status?: ScanJobStatus;
          requested_by?: string;
          blocked_reason?: string | null;
          authorization_canonical_target?: string | null;
          authorization_asset_kind?: AssetKind | null;
          authorization_verified_at?: string | null;
          validation_profile_id?: string | null;
          validation_profile_version?: number | null;
          authorization_granted_at?: string | null;
          budget?: Json;
          cancel_requested_at?: string | null;
          started_at?: string | null;
          finished_at?: string | null;
          failure_code?: string | null;
          request_count?: number;
          redirect_count?: number;
          finding_count?: number;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "scan_jobs_asset_workspace_fkey"; columns: ["asset_id", "workspace_id"]; isOneToOne: false; referencedRelation: "assets"; referencedColumns: ["id", "workspace_id"] },
          { foreignKeyName: "scan_jobs_workspace_id_fkey"; columns: ["workspace_id"]; isOneToOne: false; referencedRelation: "workspaces"; referencedColumns: ["id"] }
        ];
      };
      runtime_observations: {
        Row: { id: string; workspace_id: string; job_id: string; asset_id: string; sequence: number; kind: string; payload: Json; created_at: string };
        Insert: { id?: string; workspace_id: string; job_id: string; asset_id: string; sequence: number; kind: string; payload: Json; created_at?: string };
        Update: { id?: string; workspace_id?: string; job_id?: string; asset_id?: string; sequence?: number; kind?: string; payload?: Json; created_at?: string };
        Relationships: [
          { foreignKeyName: "runtime_observations_job_workspace_asset_fkey"; columns: ["job_id", "workspace_id", "asset_id"]; isOneToOne: false; referencedRelation: "scan_jobs"; referencedColumns: ["id", "workspace_id", "asset_id"] },
          { foreignKeyName: "runtime_observations_asset_workspace_fkey"; columns: ["asset_id", "workspace_id"]; isOneToOne: false; referencedRelation: "assets"; referencedColumns: ["id", "workspace_id"] },
          { foreignKeyName: "runtime_observations_workspace_id_fkey"; columns: ["workspace_id"]; isOneToOne: false; referencedRelation: "workspaces"; referencedColumns: ["id"] }
        ];
      };
      audit_events: {
        Row: { id: string; workspace_id: string; actor_type: AuditActorType; actor_id: string | null; event_type: string; target_type: string | null; target_id: string | null; metadata: Json; created_at: string };
        Insert: { id?: string; workspace_id: string; actor_type?: AuditActorType; actor_id?: string | null; event_type: string; target_type?: string | null; target_id?: string | null; metadata?: Json; created_at?: string };
        Update: { id?: string; workspace_id?: string; actor_type?: AuditActorType; actor_id?: string | null; event_type?: string; target_type?: string | null; target_id?: string | null; metadata?: Json; created_at?: string };
        Relationships: [{ foreignKeyName: "audit_events_workspace_id_fkey"; columns: ["workspace_id"]; isOneToOne: false; referencedRelation: "workspaces"; referencedColumns: ["id"] }];
      };
      workspace_usage: {
        Row: { workspace_id: string; registered_assets: number; verification_attempts_today: number; verification_attempt_date: string; queued_jobs: number; updated_at: string };
        Insert: { workspace_id: string; registered_assets?: number; verification_attempts_today?: number; verification_attempt_date?: string; queued_jobs?: number; updated_at?: string };
        Update: { workspace_id?: string; registered_assets?: number; verification_attempts_today?: number; verification_attempt_date?: string; queued_jobs?: number; updated_at?: string };
        Relationships: [{ foreignKeyName: "workspace_usage_workspace_id_fkey"; columns: ["workspace_id"]; isOneToOne: true; referencedRelation: "workspaces"; referencedColumns: ["id"] }];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      workspace_role: WorkspaceRole;
      asset_kind: AssetKind;
      asset_verification_status: AssetVerificationStatus;
      scan_job_status: ScanJobStatus;
      scan_job_kind: ScanJobKind;
      audit_actor_type: AuditActorType;
    };
    CompositeTypes: Record<string, never>;
  };
};
