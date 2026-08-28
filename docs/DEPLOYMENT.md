# Deployment

## Domain

Use Cloudflare as the authoritative DNS provider for `scopeforge.dev`, but keep the Vercel application A/CNAME records in DNS-only mode.

This design is intentional. Vercel does not recommend a reverse proxy such as Cloudflare in front of Vercel because it reduces Vercel traffic visibility and can introduce caching and security-detection issues. Cloudflare Turnstile does not require proxying and can still protect the authentication forms.

## TLS

No custom CSR is required for the normal deployment. Add `scopeforge.dev` to the Vercel project, configure the DNS records Vercel requests, and wait for DNS verification. Vercel then provisions and renews the public certificate automatically.

The `.dev` TLD is HTTPS-only in modern browsers, so do not point production DNS at an origin until certificate provisioning is ready.

## Supabase

Production database project: `ScopeForge` in `ap-southeast-1`.

Required Vercel public environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SITE_URL=https://scopeforge.dev`

Required Vercel server-only environment variable for trusted application operations:

- `SUPABASE_SECRET_KEY`

The public and secret Supabase values must belong to the same dedicated ScopeForge project. Never add a Supabase secret/service key to client-side variables or Git.

## Turnstile

When Cloudflare Turnstile is enabled, configure both values in Vercel:

- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY`

The site key is browser-visible. The secret key is server-only.

## Private repository artifact storage

Before enabling production repository snapshot acquisition, configure the private R2 storage variables:

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`

The bucket must not allow public object access. Long-lived R2 credentials remain server-only. Browser clients and sandboxed scanners must never receive them.

Repository snapshot acquisition also depends on a separately deployed and verified worker runtime. A successful Vercel deployment by itself does not make the Phase 6B worker queue operational.

## Hosted repository scanning

Phase 6C hosted repository scanning must remain hard-disabled at public launch until production acceptance is proven on a Linux worker with rootless Podman and cgroup v2.

The acceptance gate must demonstrate at least:

- zero outbound network access from the scanner container
- read-only repository input and root filesystem enforcement
- active CPU, memory and PID controls
- bounded scratch and output behavior
- cancellation that terminates the underlying container
- immutable server-selected scanner image and command

The Vercel application is the control plane, not the scanner host. Do not attempt to run the Podman scanner inside Vercel Functions.

## Launch verification

Before assigning production traffic to `scopeforge.dev`:

1. Verify the Vercel deployment was built from the intended merged Git commit.
2. Verify the production Supabase URL, publishable key and server secret all belong to the ScopeForge project.
3. Verify `NEXT_PUBLIC_SITE_URL` is exactly `https://scopeforge.dev`.
4. Verify authentication works and Turnstile succeeds when enabled.
5. Verify the dashboard loads without runtime errors.
6. Verify repository snapshot controls are enabled only when private R2 storage and the acquisition worker are operational.
7. Verify hosted Phase 6C repository scanning still reports unavailable until its separate rootless-Podman acceptance gate is complete.
8. Add `scopeforge.dev` to Vercel, apply Vercel's requested Cloudflare DNS records in DNS-only mode, and wait for Vercel TLS verification before treating the domain as live.
