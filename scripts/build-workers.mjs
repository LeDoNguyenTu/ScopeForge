import { copyFile, rm } from "node:fs/promises";
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
};
await build({
  ...shared,
  entryPoints: ["packages/worker-runtime/entry.ts"],
  outfile: `${outdir}/scopeforge-worker.cjs`,
});
await build({
  ...shared,
  entryPoints: ["packages/runtime-worker-runner/container-entry.ts"],
  outfile: `${outdir}/runtime-worker-entry.js`,
});
await build({
  ...shared,
  entryPoints: ["packages/httpx-worker-runner/container-entry.ts"],
  outfile: `${outdir}/httpx-worker-entry.js`,
});
await build({
  ...shared,
  entryPoints: ["packages/nuclei-worker-runner/container-entry.ts"],
  outfile: `${outdir}/nuclei-worker-entry.js`,
});
await build({
  ...shared,
  entryPoints: ["packages/hosted-scanner-runner/container-entry.ts"],
  outfile: `${outdir}/hosted-scanner-entry.js`,
  external: [
    "performance",
    "ajv",
    "ajv-formats",
    "ajv-formats-draft2019",
    "libxmljs2",
    "xmlbuilder2",
  ],
});
await copyFile(
  "node_modules/@cdktf/hcl2json/main.wasm.gz",
  `${outdir}/main.wasm.gz`,
);
