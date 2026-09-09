import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const RULE_COUNTS = Object.freeze({
  "iac/docker-floating-base-image": 1,
  "iac/github-actions-write-all-permissions": 1,
  "iac/kubernetes-privileged-container": 1,
  "iac/terraform-aws-public-rds": 1,
});
const RULE_IDS = Object.freeze(Object.keys(RULE_COUNTS));
const FIXTURES_PER_FAMILY = 150;

async function write(root, relativePath, content) {
  const destination = join(root, relativePath);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, content, "utf8");
}

function dockerfile(index) {
  const buildBase = index === 0 ? "node:latest" : "node:22.18.0";
  return [
    `FROM ${buildBase} AS build`,
    "WORKDIR /app",
    "COPY package.json /app/package.json",
    "RUN printf '%s\\n' build",
    "FROM node:22.18.0",
    "USER node",
    "WORKDIR /app",
    "COPY --from=build /app /app",
    "CMD [\"node\", \"server.js\"]",
  ].join("\n") + "\n";
}

function kubernetesManifest(index, suffix) {
  return [
    "apiVersion: apps/v1",
    "kind: Deployment",
    "metadata:",
    `  name: benchmark-${suffix}`,
    "spec:",
    "  selector:",
    "    matchLabels:",
    `      app: benchmark-${suffix}`,
    "  template:",
    "    metadata:",
    "      labels:",
    `        app: benchmark-${suffix}`,
    "    spec:",
    "      automountServiceAccountToken: false",
    "      containers:",
    "        - name: app",
    "          image: example.invalid/app:1.0.0",
    "          securityContext:",
    `            privileged: ${index === 0 ? "true" : "false"}`,
    "            allowPrivilegeEscalation: false",
    "            readOnlyRootFilesystem: true",
    "            runAsNonRoot: true",
    "        - name: sidecar",
    "          image: example.invalid/sidecar:1.0.0",
    "          securityContext:",
    "            privileged: false",
    "            allowPrivilegeEscalation: false",
    "            readOnlyRootFilesystem: true",
    "            runAsNonRoot: true",
  ].join("\n") + "\n";
}

function terraformFile(index, suffix) {
  return [
    `resource "aws_db_instance" "benchmark_${suffix}" {`,
    `  identifier          = "scopeforge-${suffix}"`,
    "  engine              = \"postgres\"",
    "  instance_class      = \"db.t3.micro\"",
    "  allocated_storage   = 20",
    `  publicly_accessible = ${index === 0 ? "true" : "false"}`,
    "  storage_encrypted   = true",
    "  skip_final_snapshot = true",
    "}",
  ].join("\n") + "\n";
}

function workflowFile(index, suffix) {
  const permissions = index === 0
    ? ["permissions: write-all"]
    : ["permissions:", "  contents: read"];
  return [
    `name: Benchmark ${suffix}`,
    "on: push",
    ...permissions,
    "jobs:",
    "  build:",
    "    runs-on: ubuntu-latest",
    "    steps:",
    "      - run: printf '%s\\n' build",
    "  verify:",
    "    runs-on: ubuntu-latest",
    "    steps:",
    "      - run: printf '%s\\n' verify",
  ].join("\n") + "\n";
}

export async function buildIacHeavyFixture(root) {
  for (let index = 0; index < FIXTURES_PER_FAMILY; index += 1) {
    const suffix = String(index).padStart(3, "0");
    await write(root, `docker/${suffix}/Dockerfile.${suffix}`, dockerfile(index));
    await write(root, `k8s/deployment-${suffix}.yaml`, kubernetesManifest(index, suffix));
    await write(root, `terraform/rds-${suffix}.tf`, terraformFile(index, suffix));
    await write(root, `.github/workflows/benchmark-${suffix}.yml`, workflowFile(index, suffix));
  }

  await write(
    root,
    ".scopeforge.json",
    `${JSON.stringify(
      {
        version: 1,
        scanners: ["iac"],
        rules: { include: RULE_IDS },
      },
      null,
      2,
    )}\n`,
  );
}

export const IAC_HEAVY_PROFILE = Object.freeze({
  id: "iac-heavy-v1",
  expectedFiles: 601,
  expectedFindingRuleCounts: RULE_COUNTS,
  maxWallMs: 30_000,
  buildFixture: buildIacHeavyFixture,
  async preflight() {},
});
