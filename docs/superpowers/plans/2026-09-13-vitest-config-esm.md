# Vitest Config ESM Warning Removal Plan

**Goal:** Remove Vite's future native-config-loader warning without converting the whole ScopeForge package to ESM or disturbing the CommonJS CLI build.

**Architecture:** Treat the Vitest config itself as ESM by moving it from `vitest.config.ts` to `vitest.config.mts`. Replace CommonJS-only `__dirname` usage with a URL-derived filesystem path. Keep root `package.json` without `type: module` so the emitted CommonJS CLI remains unaffected.

## Constraints

- Base this maintenance work on the Node 24-aligned Phase 10A3 head.
- Do not change scanner/domain/worker behavior.
- Do not change migrations, secrets, Vercel environment configuration, or runtime feature flags.
- Do not add `VITE_CONFIG_NATIVE_IGNORE_WARNING`; remove the cause rather than suppressing the warning.
- Do not set root `package.json` to `type: module`.

## Task 1 - RED architecture guard

Create `tests/architecture/vitest-config-module-format.test.ts` that requires:

- `vitest.config.mts` to exist
- legacy `vitest.config.ts` to be absent
- root package to remain non-ESM (`type !== "module"`)
- ESM config to avoid `__dirname`

Run stacked PR CI and confirm the new test alone fails against the current config layout while existing tests remain green.

## Task 2 - Minimal GREEN implementation

- Create `vitest.config.mts` with the current Vitest configuration.
- Replace `path.resolve(__dirname, ".")` with a standard ESM filesystem path derived using `fileURLToPath(new URL(".", import.meta.url))`.
- Delete `vitest.config.ts`.
- Run the complete CI matrix under Node 24.
- Confirm the previous Vite warning `ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1)` is absent from logs, not merely suppressed.

## Task 3 - Integrate safely

- Merge the stacked PR only after full GREEN evidence.
- Revalidate PR #77 exact head if this executable/tooling change is merged into it.
- Return PR #77 to draft after validation.
- Keep #79 and the Phase 10A2/10A3 operational canaries as independent release gates.
