# Security Model

ScopeForge is intended for defensive testing of systems that the user owns or is explicitly authorized to assess.

## Phase 1 guarantees

- A separate Supabase project isolates ScopeForge from unrelated applications.
- Public database tables use Row Level Security.
- Workspace membership is the authorization boundary.
- Browser code receives only a publishable Supabase key.
- Private credentials remain server-side and are never committed.
- Security headers are emitted by the application.
- Active scanning is not enabled in Phase 1.

## Planned active-test guardrails

- Target ownership verification before hosted scans.
- DNS and IP validation to block private, loopback, link-local and metadata destinations.
- Bounded redirects, response sizes, concurrency and execution time.
- Non-destructive hosted scan profiles by default.
- Per-user and per-workspace quotas.
- Audit events for scope changes and scan execution.
