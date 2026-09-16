import { rm } from "node:fs/promises";
import { build } from "esbuild";

const outdir = ".scopeforge-worker-build";
await rm(outdir, { recursive: true, force: true });
const shared = {
  bundle: true,
  platform: "node",
  target: "node24",
  format: "cjs",
  sourcemap: false,
  minify: false,
  logLevel: "warning",
  tsconfig: "tsconfig.json",
  packages: "external",
};
await build({
  ...shared,
  entryPoints: ["packages/worker-runtime/entry.ts"],
  outfile: `${outdir}/scopeforge-worker.cjs`,
});
await build({
  ...shared,
  entryPoints: ["packages/hosted-scanner-runner/container-entry.ts"],
  outfile: `${outdir}/hosted-scanner-entry.js`,
});
