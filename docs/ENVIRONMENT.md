# Environment Configuration

Client-safe variables:

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`

Server-only variables planned for later phases:

- `TURNSTILE_SECRET_KEY`
- R2 credentials
- worker service credentials

Secrets must be configured in the hosting platform and never committed to the repository.
