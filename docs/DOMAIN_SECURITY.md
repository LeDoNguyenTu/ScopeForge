# Domain Security

For the Vercel-hosted application, Cloudflare should be the authoritative DNS provider while the Vercel A/CNAME records stay DNS-only.

This preserves Vercel's native traffic visibility and avoids the reliability and bot-detection tradeoffs of putting a second reverse proxy in front of Vercel. Cloudflare Turnstile can still protect authentication forms without proxying application traffic.

When the application is ready for public access:

1. Add `scopeforge.dev` to the Vercel project.
2. Add the exact DNS records Vercel requests in Cloudflare and leave them DNS-only.
3. Allow Vercel to complete domain verification and automatic TLS provisioning.
4. Configure `NEXT_PUBLIC_SITE_URL=https://scopeforge.dev`.
5. Add Turnstile to sign-in, sign-up and recovery.
6. Add a Vercel firewall rate limit to the highest-risk public endpoint group.
7. Keep Supabase Auth rate limits enabled as an independent abuse-control layer.

No custom CSR is required for this architecture.
