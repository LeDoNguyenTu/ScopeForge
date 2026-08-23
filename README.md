# ScopeForge

ScopeForge is an open-source application security platform for authorized testing from code to runtime. The project is being built in deliberate phases so each security boundary is validated before deeper scanning capability is enabled.

## Current status

**Phase 1 - Foundation**

Implemented:

- Next.js application shell and responsive design system
- Supabase authentication wiring
- Multi-tenant workspaces and roles
- Row Level Security for exposed tables
- Automatic profile and workspace onboarding
- Server-side session refresh
- Baseline response security headers
- Separate production Supabase project in Singapore
- Architecture and security documentation

Not enabled yet:

- Asset scanning
- Repository scanning
- DAST or API fuzzing
- Background workers

These are intentionally deferred to later phases.

## Local development

```bash
cp .env.example .env.local
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Database

The applied Supabase migrations are committed under `supabase/migrations/`.

## Security

ScopeForge is designed for systems you own, labs and explicitly authorized security assessments. See `docs/SECURITY.md`.

## License

MIT.
