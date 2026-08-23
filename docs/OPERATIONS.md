# Operational Baseline

The public trial will use layered abuse controls rather than relying on a single provider:

- Supabase Auth endpoint limits
- Cloudflare Turnstile on public authentication flows
- Application-level quotas for scan creation
- Vercel firewall controls for sensitive application routes
- Independent worker concurrency limits once scanner execution is introduced

Operational limits will be documented and adjusted from observed trial traffic rather than hidden in client code.
