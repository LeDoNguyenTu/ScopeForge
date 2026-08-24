import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export const MEDIUM_FIXTURE = Object.freeze({
  name: "scanner-medium-v1",
  expectedFiles: 700
});

async function write(root, relativePath, content) {
  const destination = join(root, relativePath);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, content, "utf8");
}

async function writeSourceFiles(root) {
  for (let index = 0; index < 310; index += 1) {
    const suffix = String(index).padStart(3, "0");
    await write(root, `src/ts/module-${suffix}.ts`, `export const value${index}: number = ${index};\n`);
    await write(root, `src/js/module-${suffix}.js`, `export const value${index} = ${index};\n`);
  }
}

async function writeInfrastructureFiles(root) {
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
}

async function writeConfigurationFiles(root) {
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
}

async function writeDependencyFiles(root) {
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
}

async function writeOtherFiles(root) {
  await write(root, "docs/one.md", "# Benchmark fixture\n\nStatic repository data only.\n");
  await write(root, "docs/two.md", "# Scope\n\nNo target code is executed.\n");
}

export async function buildMediumScannerFixture(root) {
  await writeSourceFiles(root);
  await writeInfrastructureFiles(root);
  await writeConfigurationFiles(root);
  await writeDependencyFiles(root);
  await writeOtherFiles(root);
}
