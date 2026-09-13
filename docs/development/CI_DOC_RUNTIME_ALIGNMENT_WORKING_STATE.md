# CI Documentation Runtime Alignment Working State

Last updated: 2026-09-13 (Asia/Singapore)

## Purpose

Align the public `docs/scanner/CI.md` workflow example with the released Node 24 runtime contract without changing scanner behavior, application behavior, migrations, provider settings, environment variables, or hosted runtime gates.

## TDD plan

1. Add an architecture regression guard requiring the public CI example to use Node 24 and reject Node 22.
2. Capture the expected RED CI failure while the guide still contains `node-version: 22`.
3. Change only the documented workflow example to Node 24.
4. Run exact-branch GREEN validation.
5. Review the isolated diff and merge only if green.

## Release isolation

This task is documentation/test maintenance only. It must not alter:

- ScopeForge application or authorization behavior
- Supabase schema/data/migrations
- GitHub App secrets/settings
- Vercel environment variables
- hosted worker/runtime gates
- PR #76/#77 operational release gates
- issue #79 acceptance requirements
