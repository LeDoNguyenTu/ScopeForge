export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";
export type AssetKind = "web_application" | "api" | "repository";
export type AssetVerificationStatus = "unverified" | "pending" | "verified" | "failed";
export type ScanJobStatus = "queued" | "running" | "succeeded" | "failed" | "blocked" | "cancelled";
export type ScanJobKind = "phase2_blocked" | "passive_runtime" | "active_validation";
export type AuditActorType = "user" | "system";
export type SecuritySeverity = "critical" | "high" | "medium" | "low" | "info";
export type SecurityConfidence = "high" | "medium" | "low";
export type SecurityValidationState = "unvalidated" | "static_confirmed" | "runtime_observed" | "runtime_validated" | "user_confirmed";
export type SecurityProvenanceKind = "observed" | "scanner-derived" | "user-confirmed" | "inferred";
export type SecurityFindingSourceKind = "deterministic-passive-scanner" | "deterministic-runtime-scanner" | "external-scanner" | "user-confirmed" | "advisory-inference";
export type SecurityEvidenceKind = "repository-location" | "static-analysis" | "dependency" | "http-observation" | "tls-observation" | "user-confirmed" | "artifact-reference";
export type ContentClassification = "public" | "internal" | "sensitive" | "secret";
export type FindingLifecycleState = "open" | "acknowledged" | "in_progress" | "resolved" | "retest_pending" | "verified_fixed" | "accepted_risk" | "false_positive";

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
          id?: string; workspace_id: string; asset_id: string; job_kind?: ScanJobKind; status?: ScanJobStatus; requested_by: string; blocked_reason?: string | null; authorization_canonical_target?: string | null; authorization_asset_kind?: AssetKind | null; authorization_verified_at?: string | null; validation_profile_id?: string | null; validation_profile_version?: number | null; authorization_granted_at?: string | null; budget?: Json; cancel_requested_at?: string | null; started_at?: string | null; finished_at?: string | null; failure_code?: string | null; request_count?: number; redirect_count?: number; finding_count?: number; created_at?: string;
        };
        Update: {
          id?: string; workspace_id?: string; asset_id?: string; job_kind?: ScanJobKind; status?: ScanJobStatus; requested_by?: string; blocked_reason?: string | null; authorization_canonical_target?: string | null; authorization_asset_kind?: AssetKind | null; authorization_verified_at?: string | null; validation_profile_id?: string | null; validation_profile_version?: number | null; authorization_granted_at?: string | null; budget?: Json; cancel_requested_at?: string | null; started_at?: string | null; finished_at?: string | null; failure_code?: string | null; request_count?: number; redirect_count?: number; finding_count?: number; created_at?: string;
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
      security_findings: {
        Row: { workspace_id: string; finding_id: string; asset_id: string; source_kind: SecurityFindingSourceKind; source_id: string; source_version: string | null; rule_ref: string; title: string; description: string; severity: SecuritySeverity; confidence: SecurityConfidence; validation_state: SecurityValidationState; provenance_kind: SecurityProvenanceKind; location: Json | null; taxonomy: Json; remediation: Json | null; lifecycle_state: FindingLifecycleState; first_seen_at: string; last_seen_at: string; last_seen_job_id: string | null; created_at: string; updated_at: string };
        Insert: { workspace_id: string; finding_id: string; asset_id: string; source_kind: SecurityFindingSourceKind; source_id: string; source_version?: string | null; rule_ref: string; title: string; description: string; severity: SecuritySeverity; confidence: SecurityConfidence; validation_state: SecurityValidationState; provenance_kind: SecurityProvenanceKind; location?: Json | null; taxonomy: Json; remediation?: Json | null; lifecycle_state?: FindingLifecycleState; first_seen_at: string; last_seen_at: string; last_seen_job_id?: string | null; created_at?: string; updated_at?: string };
        Update: { workspace_id?: string; finding_id?: string; asset_id?: string; source_kind?: SecurityFindingSourceKind; source_id?: string; source_version?: string | null; rule_ref?: string; title?: string; description?: string; severity?: SecuritySeverity; confidence?: SecurityConfidence; validation_state?: SecurityValidationState; provenance_kind?: SecurityProvenanceKind; location?: Json | null; taxonomy?: Json; remediation?: Json | null; lifecycle_state?: FindingLifecycleState; first_seen_at?: string; last_seen_at?: string; last_seen_job_id?: string | null; created_at?: string; updated_at?: string };
        Relationships: [
          { foreignKeyName: "security_findings_asset_workspace_fkey"; columns: ["asset_id", "workspace_id"]; isOneToOne: false; referencedRelation: "assets"; referencedColumns: ["id", "workspace_id"] },
          { foreignKeyName: "security_findings_last_seen_job_fkey"; columns: ["last_seen_job_id", "workspace_id", "asset_id"]; isOneToOne: false; referencedRelation: "scan_jobs"; referencedColumns: ["id", "workspace_id", "asset_id"] }
        ];
      };
      security_evidence: {
        Row: { workspace_id: string; evidence_id: string; asset_id: string; kind: SecurityEvidenceKind; provenance_kind: SecurityProvenanceKind; summary: string; classification: ContentClassification; artifact_ref: string | null; created_at: string };
        Insert: { workspace_id: string; evidence_id: string; asset_id: string; kind: SecurityEvidenceKind; provenance_kind: SecurityProvenanceKind; summary: string; classification: ContentClassification; artifact_ref?: string | null; created_at?: string };
        Update: { workspace_id?: string; evidence_id?: string; asset_id?: string; kind?: SecurityEvidenceKind; provenance_kind?: SecurityProvenanceKind; summary?: string; classification?: ContentClassification; artifact_ref?: string | null; created_at?: string };
        Relationships: [{ foreignKeyName: "security_evidence_asset_workspace_fkey"; columns: ["asset_id", "workspace_id"]; isOneToOne: false; referencedRelation: "assets"; referencedColumns: ["id", "workspace_id"] }];
      };
      security_finding_evidence: {
        Row: { workspace_id: string; finding_id: string; evidence_id: string; created_at: string };
        Insert: { workspace_id: string; finding_id: string; evidence_id: string; created_at?: string };
        Update: { workspace_id?: string; finding_id?: string; evidence_id?: string; created_at?: string };
        Relationships: [
          { foreignKeyName: "security_finding_evidence_finding_fkey"; columns: ["workspace_id", "finding_id"]; isOneToOne: false; referencedRelation: "security_findings"; referencedColumns: ["workspace_id", "finding_id"] },
          { foreignKeyName: "security_finding_evidence_evidence_fkey"; columns: ["workspace_id", "evidence_id"]; isOneToOne: false; referencedRelation: "security_evidence"; referencedColumns: ["workspace_id", "evidence_id"] }
        ];
      };
      security_finding_occurrences: {
        Row: { id: string; workspace_id: string; finding_id: string; asset_id: string; scan_job_id: string; scan_run_ref: string | null; observed_at: string; source_kind: SecurityFindingSourceKind; source_id: string; source_version: string | null; validation_state: SecurityValidationState; created_at: string };
        Insert: { id?: string; workspace_id: string; finding_id: string; asset_id: string; scan_job_id: string; scan_run_ref?: string | null; observed_at: string; source_kind: SecurityFindingSourceKind; source_id: string; source_version?: string | null; validation_state: SecurityValidationState; created_at?: string };
        Update: { id?: string; workspace_id?: string; finding_id?: string; asset_id?: string; scan_job_id?: string; scan_run_ref?: string | null; observed_at?: string; source_kind?: SecurityFindingSourceKind; source_id?: string; source_version?: string | null; validation_state?: SecurityValidationState; created_at?: string };
        Relationships: [
          { foreignKeyName: "security_finding_occurrences_finding_fkey"; columns: ["workspace_id", "finding_id"]; isOneToOne: false; referencedRelation: "security_findings"; referencedColumns: ["workspace_id", "finding_id"] },
          { foreignKeyName: "security_finding_occurrences_asset_workspace_fkey"; columns: ["asset_id", "workspace_id"]; isOneToOne: false; referencedRelation: "assets"; referencedColumns: ["id", "workspace_id"] },
          { foreignKeyName: "security_finding_occurrences_job_workspace_asset_fkey"; columns: ["scan_job_id", "workspace_id", "asset_id"]; isOneToOne: false; referencedRelation: "scan_jobs"; referencedColumns: ["id", "workspace_id", "asset_id"] }
        ];
      };
      security_finding_events: {
        Row: { id: string; workspace_id: string; finding_id: string; scan_job_id: string | null; actor_type: AuditActorType; actor_id: string | null; event_type: string; from_lifecycle: FindingLifecycleState | null; to_lifecycle: FindingLifecycleState | null; reason: string | null; metadata: Json; created_at: string };
        Insert: { id?: string; workspace_id: string; finding_id: string; scan_job_id?: string | null; actor_type: AuditActorType; actor_id?: string | null; event_type: string; from_lifecycle?: FindingLifecycleState | null; to_lifecycle?: FindingLifecycleState | null; reason?: string | null; metadata?: Json; created_at?: string };
        Update: { id?: string; workspace_id?: string; finding_id?: string; scan_job_id?: string | null; actor_type?: AuditActorType; actor_id?: string | null; event_type?: string; from_lifecycle?: FindingLifecycleState | null; to_lifecycle?: FindingLifecycleState | null; reason?: string | null; metadata?: Json; created_at?: string };
        Relationships: [
          { foreignKeyName: "security_finding_events_finding_fkey"; columns: ["workspace_id", "finding_id"]; isOneToOne: false; referencedRelation: "security_findings"; referencedColumns: ["workspace_id", "finding_id"] },
          { foreignKeyName: "security_finding_events_scan_job_id_fkey"; columns: ["scan_job_id"]; isOneToOne: false; referencedRelation: "scan_jobs"; referencedColumns: ["id"] }
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
    Functions: {
      persist_passive_runtime_result: {
        Args: {
          target_workspace_id: string;
          target_asset_id: string;
          target_job_id: string;
          observation_rows: Json;
          finding_rows: Json;
          evidence_rows: Json;
          observed_at: string;
        };
        Returns: undefined;
      };
      persist_active_validation_result: {
        Args: {
          target_workspace_id: string;
          target_asset_id: string;
          target_job_id: string;
          observation_row: Json;
          finding_rows: Json;
          evidence_rows: Json;
          observed_at: string;
        };
        Returns: undefined;
      };
    };
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
