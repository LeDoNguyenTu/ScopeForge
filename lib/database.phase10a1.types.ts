import type { Database as BaseDatabase } from "./database.types";

export type GitHubConnectionStatus = "active" | "suspended" | "removed";
export type GitHubRepositorySelection = "all" | "selected";
export type GitHubAccountType = "User" | "Organization";
export type GitHubRepositoryAccessStatus = "active" | "inaccessible" | "removed";

export type GitHubConnectionTable = {
  Row: {
    id: string;
    workspace_id: string;
    installation_id: number;
    account_id: number;
    account_login: string;
    account_type: GitHubAccountType;
    repository_selection: GitHubRepositorySelection;
    status: GitHubConnectionStatus;
    installed_by: string;
    created_at: string;
    updated_at: string;
  };
  Insert: {
    id?: string;
    workspace_id: string;
    installation_id: number;
    account_id: number;
    account_login: string;
    account_type: GitHubAccountType;
    repository_selection: GitHubRepositorySelection;
    status?: GitHubConnectionStatus;
    installed_by: string;
    created_at?: string;
    updated_at?: string;
  };
  Update: {
    installation_id?: number;
    account_id?: number;
    account_login?: string;
    account_type?: GitHubAccountType;
    repository_selection?: GitHubRepositorySelection;
    status?: GitHubConnectionStatus;
    installed_by?: string;
    updated_at?: string;
  };
  Relationships: [
    { foreignKeyName: "github_connections_workspace_id_fkey"; columns: ["workspace_id"]; isOneToOne: true; referencedRelation: "workspaces"; referencedColumns: ["id"] }
  ];
};

export type GitHubRepositoryLinkTable = {
  Row: {
    id: string;
    workspace_id: string;
    github_connection_id: string;
    asset_id: string;
    repository_id: number;
    owner_login: string;
    repository_name: string;
    full_name: string;
    default_branch: string;
    is_private: boolean;
    html_url: string;
    auto_scan_enabled: boolean;
    access_status: GitHubRepositoryAccessStatus;
    created_at: string;
    updated_at: string;
  };
  Insert: {
    id?: string;
    workspace_id: string;
    github_connection_id: string;
    asset_id: string;
    repository_id: number;
    owner_login: string;
    repository_name: string;
    full_name: string;
    default_branch: string;
    is_private: boolean;
    html_url: string;
    auto_scan_enabled?: boolean;
    access_status?: GitHubRepositoryAccessStatus;
    created_at?: string;
    updated_at?: string;
  };
  Update: {
    github_connection_id?: string;
    repository_id?: number;
    owner_login?: string;
    repository_name?: string;
    full_name?: string;
    default_branch?: string;
    is_private?: boolean;
    html_url?: string;
    auto_scan_enabled?: boolean;
    access_status?: GitHubRepositoryAccessStatus;
    updated_at?: string;
  };
  Relationships: [
    { foreignKeyName: "github_repository_links_connection_workspace_fkey"; columns: ["github_connection_id", "workspace_id"]; isOneToOne: false; referencedRelation: "github_connections"; referencedColumns: ["id", "workspace_id"] },
    { foreignKeyName: "github_repository_links_asset_workspace_fkey"; columns: ["asset_id", "workspace_id"]; isOneToOne: true; referencedRelation: "assets"; referencedColumns: ["id", "workspace_id"] },
    { foreignKeyName: "github_repository_links_workspace_id_fkey"; columns: ["workspace_id"]; isOneToOne: false; referencedRelation: "workspaces"; referencedColumns: ["id"] }
  ];
};

export type Phase10a1Database = Omit<BaseDatabase, "public"> & {
  public: Omit<BaseDatabase["public"], "Tables"> & {
    Tables: BaseDatabase["public"]["Tables"] & {
      github_connections: GitHubConnectionTable;
      github_repository_links: GitHubRepositoryLinkTable;
    };
  };
};
