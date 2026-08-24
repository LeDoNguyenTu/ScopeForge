import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { performance } from "node:perf_hooks";

const require = createRequire(import.meta.url);
const { runCli } = require("../.scopeforge-build/packages/cli/run-cli.js");

const EXPECTED_FILES = 700;
const MAX_WALL_MS = 20_000;

async function write(root, relativePath, content) {
  const destination = join(root, relativePath);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, content, "utf8");
}

async function buildFixture(root) {
  for (let index = 0; index < 310; index += 1) {
    await write(
      root,
      `src/ts/module-${String(index).padStart(3, "0")}.ts`,
      `export const value${index}: number = ${index};\n`
    );
    await write(
      root,
      `src/js/module-${String(index).padStart(3, "0")}.js`,
      `export const value${index} = ${index};\n`
    );
  }

  for (let index = 0; index < 15; index += 1) {
    const suffix = String(index).padStart(2, "0");
    await write(
      root,
      `containers/${suffix}/Dockerfile.${suffix}`,
      "FROM node:22\nUSER node\nWORKDIR /app\nCOPY . /app\n"
    );
    await write(
      root,
      `k8s/deployment-${suffix}.yaml`,
      [
        "apiVersion: apps/v1",
        "kind: Deployment",
        "metadata:",
        `  name: benchmark-${suffix}`,
        "spec:",
        "  template:",
        "    spec:",
        "      automountServiceAccountToken: false",
        "      containers:",
        "        - name: app",
        "          image: example.invalid/app:1.0.0",
        "          securityContext:",
        "            allowPrivilegeEscalation: false",
        "            runAsNonRoot: true",
        "            readOnlyRootFilesystem: true",
        "            capabilities:",
        "              drop: [ALL]"
      ].join("\n") + "\n"
    );
    await write(
      root,
      `terraform/safe-${suffix}.tf`,
      [
        `resource \"aws_security_group\" \"safe_${suffix}\" {`,
        "  ingress {",
        "    from_port   = 443",
        "    to_port     = 443",
        "    protocol    = \"tcp\"",
        "    cidr_blocks = [\"10.0.0.0/8\"]",
        "  }",
        "}"
      ].join("\n") + "\n"
    );
    await write(
      root,
      `.github/workflows/benchmark-${suffix}.yml`,
      [
        `name: Benchmark ${suffix}`,
        "on: push",
        "permissions: read-all",
        "jobs:",
        "  test:",
        "    runs-on: ubuntu-latest",
        "    steps:",
        "      - run: printf '%s\\n' safe"
      ].join("\n") + "\n"
    );
  }

  for (let index = 0; index < 8; index += 1) {
    const suffix = String(index).padStart(2, "0");
    await write(root, `config/npm-${suffix}/.npmrc`, "strict-ssl=true\n");
    await write(
      root,
      `config/vercel-${suffix}/vercel.json`,
      JSON.stringify(
        {
          headers: [
            {
              source: "/api/(.*)",
              headers: [
                {
                  key: "Access-Control-Allow-Origin",
                  value: "https://app.example"
                }
              ]
            }
          ]
        },
        null,
        2
      ) + "\n"
    );
  }

  await write(
    root,
    "package.json",
    JSON.stringify({ name: "scopeforge-benchmark", version: "1.0.0", private: true }, null, 2) + "\n"
  );
  await write(
    root,
    "package-lock.json",
    JSON.stringify(
      {
        name: "scopeforge-benchmark",
        version: "1.0.0",
        lockfileVersion: 3,
        requires: true,
        packages: {
          "": {
            name: "scopeforge-benchmark",
            version: "1.0.0"
          }
        }
      },
      null,
      2
    ) + "\n"
  );
  await write(root, "docs/one.md", "# Benchmark fixture\n\nStatic repository data only.\n");
  await write(root, "docs/two.md", "# Scope\n\nNo target code is executed.\n");
}

async function main() {
  const root = await mkdtemp(join(tmpdir(), "scopeforge-benchmark-"));
  try {
    await buildFixture(root);

    let stdout = "";
    let stderr = "";
    const rssBefore = process.memoryUsage().rss;
    const started = performance.now();
    const exitCode = await runCli(["scan", root, "--format", "json"], {
      io: {
        stdout: (value) => {
          stdout += value;
        },
        stderr: (value) => {
          stderr += value;
        }
      }
    });
    const wallMs = Math.round(performance.now() - started);
    const rssAfter = process.memoryUsage().rss;

    if (exitCode !== 0) {
      throw new Error(`benchmark scan exited ${exitCode}: ${stderr.trim() || "no diagnostic"}`);
    }

    let parsed;
    try {
      parsed = JSON.parse(stdout);
    } catch {
      throw new Error("benchmark scan did not emit valid JSON");
    }

    const filesAnalyzed = parsed?.inventory?.filesAnalyzed;
    const findings = Array.isArray(parsed?.findings) ? parsed.findings.length : -1;
    const errors = Array.isArray(parsed?.errors) ? parsed.errors.length : -1;
    const scanDurationMs = parsed?.scan?.durationMs;

    if (filesAnalyzed !== EXPECTED_FILES) {
      throw new Error(`expected ${EXPECTED_FILES} analyzed files, received ${String(filesAnalyzed)}`);
    }
    if (findings !== 0 || errors !== 0) {
      throw new Error(`benchmark fixture must stay clean, received ${findings} findings and ${errors} errors`);
    }
    if (!Number.isFinite(scanDurationMs) || scanDurationMs < 0) {
      throw new Error("benchmark scan metadata contains an invalid duration");
    }
    if (wallMs > MAX_WALL_MS) {
      throw new Error(`benchmark exceeded catastrophic regression ceiling: ${wallMs}ms > ${MAX_WALL_MS}ms`);
    }

    const measurement = {
      fixture: "scanner-medium-v1",
      filesAnalyzed,
      findings,
      errors,
      wallMs,
      scanDurationMs,
      rssDeltaBytes: Math.max(0, rssAfter - rssBefore),
      maxWallMs: MAX_WALL_MS
    };

    process.stdout.write(`SCOPEFORGE_BENCHMARK ${JSON.stringify(measurement)}\n`);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
