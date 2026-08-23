# Testing Strategy

Phase 1 validation focuses on tenancy, authentication and build integrity. Later phases add scanner-specific fixtures and benchmark applications.

Required gates:

- TypeScript compilation
- Next.js production build
- Supabase security advisor review after schema changes
- RLS isolation tests as workspace-scoped tables expand
- Regression fixtures for every scanner rule before it is advertised as supported
