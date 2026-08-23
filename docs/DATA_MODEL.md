# Phase 1 Data Model

```text
auth.users
   |
   +--> profiles
   |
   +--> workspace_members --> workspaces
```

A signup trigger creates the user's profile, personal workspace and owner membership atomically. Later tables such as assets, scans and findings will reference a workspace ID and inherit the same tenancy boundary.
