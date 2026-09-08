# UI preview review

## Scope

The public landing page uses a data-driven SVG topology with the reference's dark, teal and orange styling. The authenticated application uses a compact SaaS workspace: persistent desktop navigation, responsive mobile navigation, linked metrics, a recommended action, a searchable work queue, workflow guidance, and an optional attack-surface map.

- The seven sample assets, three sample findings and Web application → Identity → Data store path live in `lib/landing/sample-surface.ts`. SVG nodes, finding badges, edge endpoints, labels, counters and the ownership ring derive from this model. The before/after control closes sample findings and removes the exposure path without changing ownership verification. Dotted spokes represent workspace membership, not asserted network access.
- The risk explanation uses a plain-language potential exposure scenario without unsupported severity, impact or exploitability scores. Public data remains explicitly synthetic. Workflow numbers have high-contrast 38px badges; workflow icons are 28px and section icons are 24px. Security-card icon and text groups are vertically centered.
- Public navigation uses equal-width links with real destinations. Resources pages include downloadable asset-readiness and finding-review templates and project documentation.
- Dashboard filters combine search with severity or verification state. Findings support priority/recency sorting and six-row pagination. Links open existing authenticated asset and finding routes. The dashboard discloses the 250-record recent-finding window when the total is larger.
- Dashboard queries retain the workspace restriction. Authentication, RLS, scanner execution gates, and production records are unchanged.
- Mobile findings become readable stacked rows. The optional map uses numbered nodes and a complete linked legend on small screens, avoiding hidden or overlapping labels.
- `/preview/dashboard` contains only synthetic records and is available in development or Vercel preview deployments. It returns not found in production. `/preview/dashboard?empty=1` shows the empty state. It does not bypass authentication on `/dashboard`.

## Verification

Chrome inspection covered the actual signed-in production dashboard before modification, plus local desktop and mobile renderings of the shared dashboard components. Screenshots and local reports are in ignored `out/ui-review/`.

The release integrates `main` at `c4aaf76`, including Phase 8C publication and Phase 9A authentication hardening. Auth return-path and error-message protections remain intact. Component, dashboard-model, landing, brand and authentication tests cover the shared UI, scenario state changes, work-queue search/filter/sort/pagination and preview-route production boundary.

The integrated compatibility run passed 137 of 139 tests. Two unchanged Phase 8C publication tests fail on this Windows checkout: creating a test symlink returns EPERM, and the byte-identical Markdown comparison sees checkout CRLF instead of generated LF. Publication code, fixtures and tests have no diff from `main`; these tests were not weakened.

The earlier full-suite comparison at `222d959` had 21 identical Windows baseline failures (symlinks, permission bits, path syntax, and golden output). That result is historical, not a claim about the newer baseline. This UI pass does not change those backend tests.

The browser extension can inject `bis_skin_checked` attributes and trigger development hydration warnings. Warnings were not suppressed. The Aikido public site was consulted for workflow inspiration; its direct CDN image was blocked by browser policy, and that block was not bypassed.

The current landing graph contains no raster image: its geometry is drawn from the sample records. The older artwork remains available as a historical asset. Sample data does not access Supabase or execute security workflows.
