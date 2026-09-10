# ScopeForge portfolio demo

Branch: `demo/portfolio-20260910`. Based on `afc99eb92da6b4cb84bc994f2fb66a983a941626` (restored pre-PR49 UI).

Deploy this branch only as a Vercel preview. Do not merge it into main or promote it to production. `next.config.ts` rejects production builds, and middleware rejects the known production hosts and production runtime.

Open `/` for the real landing UI and `/dashboard` for the real dashboard components fed by local fixtures. No sign-in is required. The overview, filters, pagination, asset list, read-only asset/finding detail views, and resource library are available.

## Data and isolation

The Northstar workspace and Alex Morgan, Jordan Lee and Sam Rivera personas are fictional. Eight reserved `.example` assets include six simulated verified statuses and two unverified statuses. Eighteen sample findings cover critical through informational severity, with sample owners, evidence and remediation notes. They are all explicitly unvalidated. No target control was actually verified and no scanner ran.

The fixtures never access Supabase. All four Supabase entry points throw before creating clients, including if Vercel inherits project credentials. The demo middleware rejects all writes, auth endpoints, worker APIs, unknown paths, and the old preview route. Its matcher includes API routes and prefetches. Browser CSP only permits same-origin connections. The demo UI has no session or sign-out action. Production's database and Cloudflare configuration are unchanged.

No production account credentials belong in this branch. `vercel.json` does not include production database settings. Demo content is read-only and resets to the same fixture state on every request.

## Validation

Run `npm run test:demo`, `npm run typecheck`, and `npm run build`. Verify that `VERCEL_ENV=production npm run build` fails at configuration load. In the preview, verify overview metrics (18 findings, 8 assets, 6 verified, 75%), work queue filters and pagination, sample details, and HTTP 405 for writes / 404 for auth and worker endpoints. Screenshots must retain the demo disclosure.

## Graph presentation

The demo overview opens the attack surface map below its metrics. The WebGL renderer retains its animation, while a CSP-safe SVG scene and labels keep all assets visible when a browser has no GPU context. Both layers share node coordinates. Reduced-motion rendering redraws after canvas resize. No CSP restrictions are relaxed.

Graph verification: `node node_modules/vitest/vitest.mjs run tests/dashboard/graph-fallback.test.tsx tests/demo-isolation.test.ts tests/dashboard/attack-surface-model.test.ts` (19 tests), TypeScript checking, and a production-mode Next.js build for the isolated preview.
