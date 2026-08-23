export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

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
        Row: { workspace_id: string; user_id: string; role: "owner" | "admin" | "member" | "viewer"; joined_at: string };
        Insert: { workspace_id: string; user_id: string; role?: "owner" | "admin" | "member" | "viewer"; joined_at?: string };
        Update: { workspace_id?: string; user_id?: string; role?: "owner" | "admin" | "member" | "viewer"; joined_at?: string };
        Relationships: [{ foreignKeyName: "workspace_members_workspace_id_fkey"; columns: ["workspace_id"]; isOneToOne: false; referencedRelation: "workspaces"; referencedColumns: ["id"] }];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: { workspace_role: "owner" | "admin" | "member" | "viewer" };
    CompositeTypes: Record<string, never>;
  };
};
