# Deployment

## Domain

Use Cloudflare as the authoritative DNS provider for `scopeforge.dev`, but keep the Vercel application A/CNAME records in DNS-only mode.

This design is intentional. Vercel does not recommend a reverse proxy such as Cloudflare in front of Vercel because it reduces Vercel traffic visibility and can introduce caching and security-detection issues. Cloudflare Turnstile does not require proxying and can still protect the authentication forms.

## TLS

No custom CSR is required for the normal deployment. Add `scopeforge.dev` to the Vercel project, configure the DNS records Vercel requests, and wait for DNS verification. Vercel then provisions and renews the public certificate automatically.

The `.dev` TLD is HTTPS-only in modern browsers, so do not point production DNS at an origin until certificate provisioning is ready.

## Supabase

Production database project: `ScopeForge` in `ap-southeast-1`.

Required Vercel environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SITE_URL=https://scopeforge.dev`

Never add a Supabase secret/service key to client-side variables or Git.
