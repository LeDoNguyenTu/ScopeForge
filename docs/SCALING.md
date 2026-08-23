# Scaling Baseline

The control plane and scanner execution plane scale independently.

- PostgreSQL stores structured metadata, not large scan artifacts.
- Cloudflare R2 is planned for evidence, SBOMs and report files.
- Long-running scans will use background workers instead of request-bound Vercel functions.
- Workspace quotas and queue backpressure will prevent one trial user from consuming all scanner capacity.
- Scanner concurrency will be configurable independently of web traffic.
