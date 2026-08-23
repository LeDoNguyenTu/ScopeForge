# Technology Stack

## Control plane

- Next.js and React
- TypeScript
- Vercel hosting

## Identity and relational data

- Supabase Auth
- PostgreSQL
- Row Level Security

## Planned artifact storage

- Cloudflare R2 for scan evidence, reports, SBOMs and other large artifacts

## Planned execution plane

- Isolated background scanner workers behind a job queue
- Explicit per-workspace concurrency and resource budgets

The stack is intentionally modular so the scanner execution layer can evolve independently from the web application.
