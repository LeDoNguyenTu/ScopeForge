# Vercel deployment budget policy

Last updated: 2026-09-18.

ScopeForge currently runs on a Vercel Hobby team. To avoid exhausting the Hobby deployment-rate quota during agent-heavy development, automatic Git deployments are intentionally limited in `vercel.json`.

## Automatic deployment branches

- `main`: enabled. A merge to `main` remains the production deployment path.
- `vercel-preview-*`: enabled. Use this only for an explicit release-candidate preview.
- every other branch: disabled.

GitHub CI remains the normal validation path for feature, test, documentation, and implementation branches.

## Release-candidate preview workflow

When a branch is ready for deployment validation:

1. finish code review and GitHub CI on the normal feature branch
2. resolve the exact release-candidate commit SHA
3. create a branch named `vercel-preview-<purpose>` at that exact SHA
4. allow that branch to receive one Vercel Preview deployment
5. validate the preview
6. merge the already-reviewed candidate into `main` when safe
7. remove stale preview branches when they are no longer needed

Do not create a new preview branch for every intermediate commit.

## Why this uses branch filtering instead of Ignored Build Step

Vercel's Ignored Build Step can stop the build itself, but a cancelled/ignored deployment can still count toward deployment quota. Branch-level `git.deploymentEnabled` prevents unwanted Git-triggered deployments before that point and is therefore the appropriate control for conserving the Hobby deployment budget.

## Operational boundary

Do not disable `main` production deployments. Do not enable broad preview patterns again without confirming that the available Vercel plan can support the resulting deployment volume.

If the plan or Vercel quota behavior changes, verify current Vercel documentation before changing this policy.
