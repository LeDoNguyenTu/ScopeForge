# UI preview review

## Scope

The public landing page follows the supplied cinematic reference. The authenticated application uses a compact SaaS workspace: persistent desktop navigation, responsive mobile navigation, linked metrics, a recommended action, a searchable work queue, workflow guidance, and an optional attack-surface map.

- All seven illustration platforms have labels. Web application points to the foreground orange path; Data store points to the right orange platform. APIs, Cloud infrastructure, Sandbox, Third party, and Identity identify the remaining platforms. Image and connectors share an intrinsic coordinate system.
- Public navigation uses equal-width links with real destinations. Resources pages include downloadable asset-readiness and finding-review templates and project documentation.
- Dashboard filters combine search with severity or verification state. Findings support priority/recency sorting and six-row pagination. Links open existing authenticated asset and finding routes. The dashboard discloses the 250-record recent-finding window when the total is larger.
- Dashboard queries retain the workspace restriction. Authentication, RLS, scanner execution gates, and production records are unchanged.
- Mobile findings become readable stacked rows. The optional map uses numbered nodes and a complete linked legend on small screens, avoiding hidden or overlapping labels.
- `/preview/dashboard` contains only synthetic records and is available in development or Vercel preview deployments. It returns not found in production. `/preview/dashboard?empty=1` shows the empty state. It does not bypass authentication on `/dashboard`.

## Verification

Chrome inspection covered the actual signed-in production dashboard before modification, plus local desktop and mobile renderings of the shared dashboard components. Screenshots and local reports are in ignored `out/ui-review/`.

All 66 targeted tests pass: component, dashboard-model, landing, and brand tests, plus work-queue search/filter/sort/pagination checks and the preview-route production boundary. The optimized preview build passes, including TypeScript validation.

The earlier full-suite comparison at `222d959` had 21 identical Windows baseline failures (symlinks, permission bits, path syntax, and golden output). That result is historical, not a claim about the newer baseline. This UI pass does not change those backend tests.

The browser extension can inject `bis_skin_checked` attributes and trigger development hydration warnings. Warnings were not suppressed. The Aikido public site was consulted for workflow inspiration; its direct CDN image was blocked by browser policy, and that block was not bypassed.

The cinematic illustration reuses the existing ScopeForge preview artwork, saved as `public/command-center-cinematic.webp` (2400 × 1350, approximately 139 KiB). Marketing metrics and all sample-dashboard records are explicitly illustrative.
