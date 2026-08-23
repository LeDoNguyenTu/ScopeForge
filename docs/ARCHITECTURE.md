# ScopeForge Architecture

## Phase 1 foundation

ScopeForge is split into a control plane and scanner execution plane so the public web application never needs to become an unrestricted scanning proxy.

```text
Browser
  |
  v
Vercel / Next.js control plane
  |
  +--> Supabase Auth
  +--> Supabase PostgreSQL
  |
  +--> future scan queue
           |
           +--> isolated workers
           +--> Cloudflare R2 artifacts
```

### Tenancy

Every authenticated user belongs to one or more workspaces through `workspace_members`. Exposed tables use Row Level Security and workspace membership helpers. The `private` schema contains security-definer helpers and is not intended to be exposed through PostgREST.

### Domain and edge

`scopeforge.dev` should use Cloudflare as authoritative DNS while the Vercel application records remain DNS-only. This avoids placing an unsupported reverse proxy in front of Vercel while retaining Cloudflare DNS, R2 and Turnstile. Vercel automatically provisions the application TLS certificate after DNS verification.

### Abuse protection

Phase 1 uses Supabase Auth rate limits as the authentication baseline. Before opening the public trial, Cloudflare Turnstile will be added to sign-in, sign-up and recovery flows. A Vercel firewall rate-limit rule will protect high-value application endpoints. Scanner jobs will also have per-user and per-workspace quotas independent of authentication rate limits.
