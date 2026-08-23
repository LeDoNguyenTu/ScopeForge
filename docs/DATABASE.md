# Database Foundation

ScopeForge uses a dedicated Supabase PostgreSQL project in Singapore.

Phase 1 tables:

- `profiles`
- `workspaces`
- `workspace_members`

Every exposed table has Row Level Security enabled. Workspace access is resolved through security-definer helper functions in a non-exposed `private` schema. The onboarding trigger creates a profile, personal workspace and owner membership when a new Auth user is created.
