# ScopeForge CI Integration

ScopeForge Phase 3 is a local, passive repository scanner. A scan does not require a ScopeForge account or hosted service, and report-only behavior is the default.

## Current installation status

ScopeForge is not yet published as a standalone npm package or reusable GitHub Action. Until a versioned distribution exists, install the tool from source in an isolated directory outside the target repository workspace.

For CI safety and reproducibility:

- pin ScopeForge to a reviewed commit SHA instead of following `main`
- install ScopeForge's own dependencies with lifecycle scripts disabled using `npm ci --ignore-scripts`
- build the ScopeForge CLI in the isolated tool directory
- scan the target repository by passing `$GITHUB_WORKSPACE` explicitly
- do not install ScopeForge into the target repository's dependency tree
- do not run target lifecycle scripts, tests, builds, Docker, Terraform, kubectl, Helm, Kustomize, or workflows as part of ScopeForge scanning

## Report-only GitHub Code Scanning example

Replace `<reviewed-scopeforge-commit-sha>` with a reviewed ScopeForge commit SHA before using this workflow.

The workflow scans the checked-out repository, writes SARIF outside the target workspace, and uploads it with GitHub's standard CodeQL SARIF action when security-event write permission is available.

```yaml
name: ScopeForge

on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read
  security-events: write

jobs:
  scopeforge:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout target repository
        uses: actions/checkout@v7
        with:
          persist-credentials: false

      - name: Set up Node.js
        uses: actions/setup-node@v7
        with:
          node-version: 22
          package-manager-cache: false

      - name: Install ScopeForge in isolated tool directory
        env:
          SCOPEFORGE_REF: <reviewed-scopeforge-commit-sha>
        shell: bash
        run: |
          set -euo pipefail
          SCOPEFORGE_TOOL="$RUNNER_TEMP/scopeforge-tool"
          git clone --filter=blob:none https://github.com/LeDoNguyenTu/ScopeForge.git "$SCOPEFORGE_TOOL"
          git -C "$SCOPEFORGE_TOOL" checkout "$SCOPEFORGE_REF"
          npm --prefix "$SCOPEFORGE_TOOL" ci --ignore-scripts --no-audit --no-fund
          npm --prefix "$SCOPEFORGE_TOOL" run build:cli

      - name: Generate ScopeForge SARIF
        shell: bash
        run: |
          node "$RUNNER_TEMP/scopeforge-tool/.scopeforge-build/packages/cli/index.js" \
            scan "$GITHUB_WORKSPACE" \
            --format sarif \
            --output "$RUNNER_TEMP/scopeforge.sarif"

      - name: Upload ScopeForge SARIF
        if: ${{ always() && (github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository) }}
        uses: github/codeql-action/upload-sarif@v4
        with:
          sarif_file: ${{ runner.temp }}/scopeforge.sarif
          checkout_path: ${{ github.workspace }}
```

The scan step is report-only. Findings do not fail the job. Scanner execution errors still return a non-zero scanner-error code because incomplete analysis must not appear clean.

GitHub can restrict `security-events: write` in forked pull-request contexts. The upload condition above avoids treating a fork-token permission limitation as a scanner defect. The local ScopeForge scan can still run in that job.

If human-readable logs are also desired, run a separate terminal-format scan or upload native JSON as a workflow artifact. ScopeForge currently emits one primary output format per invocation.

## Optional severity enforcement

Enforcement is explicit. Add `--fail-on` only after the repository is ready to use findings as a merge gate.

```yaml
      - name: Enforce new high-severity findings
        shell: bash
        run: |
          node "$RUNNER_TEMP/scopeforge-tool/.scopeforge-build/packages/cli/index.js" \
            scan "$GITHUB_WORKSPACE" \
            --baseline .scopeforge-baseline.json \
            --fail-on high
```

Without a baseline, `--fail-on high` gates on all findings. With a valid baseline, the default baseline gate is `new`, so accepted existing findings stay visible but do not fail policy. Use `--baseline-gate all` only when the repository intentionally wants both existing and new findings in the gate.

A policy failure exits with code `1`. It is distinct from configuration and scanner execution failures.

## Baseline workflow

Create a baseline from the current repository state:

```bash
scopeforge baseline create .
```

The default file is `.scopeforge-baseline.json`. It stores stable finding fingerprints and safe metadata only. It does not store raw detected secrets, source snippets, arbitrary finding metadata, or remediation text.

Use it during scans:

```bash
scopeforge scan . \
  --baseline .scopeforge-baseline.json \
  --fail-on high
```

Commit a baseline only after review, using the same change-control expectations as other security policy files.

## Output examples

Terminal output:

```bash
scopeforge scan .
```

Native ScopeForge JSON:

```bash
scopeforge scan . --format json
scopeforge scan . --format json --output scopeforge-results.json
```

SARIF 2.1.0:

```bash
scopeforge scan . --format sarif --output scopeforge.sarif
```

CycloneDX 1.7 JSON SBOM:

```bash
scopeforge scan . --sbom scopeforge.cdx.json
```

SARIF and SBOM can be generated in the same scan:

```bash
scopeforge scan . \
  --format sarif \
  --output scopeforge.sarif \
  --sbom scopeforge.cdx.json
```

Normal scan output and SBOM output must use different paths. Existing output symlinks are refused. Repository-configured output paths must remain canonical relative paths inside the scan root. An explicit CLI output path may intentionally target another safe directory, such as `$RUNNER_TEMP` in CI.

## OSV network policy

Dependency inventory and SBOM generation work offline. OSV vulnerability enrichment is disabled by default.

Enable it only through the root `.scopeforge.json`:

```json
{
  "version": 1,
  "sca": {
    "osv": {
      "enabled": true
    }
  }
}
```

When enabled, ScopeForge sends only normalized npm package identity and exact version to its fixed OSV endpoint. It does not send repository source files, arbitrary target configuration, or detected secret values. A lookup failure is reported as a scanner error and is never represented as a clean vulnerability result.

## Exit codes

| Code | Meaning |
|---:|---|
| `0` | Successful scan. In report-only mode, findings may still be present. |
| `1` | Explicit policy gate failed. |
| `2` | CLI usage, configuration, baseline, or unsafe-output error. |
| `3` | Scanner execution or incomplete-analysis error. |

A report-only scan with findings returns `0`. Scanner errors return `3` so incomplete coverage cannot look like a clean scan.

## Repository configuration boundary

ScopeForge reads `.scopeforge.json` only from the explicit scan root. Nested repository content cannot silently introduce another security configuration.

Configuration can select scanner families and rules, tighten scan budgets, opt into OSV, configure baseline behavior, set an explicit policy threshold, and configure output. Repository configuration cannot raise ScopeForge's safe inventory ceilings or replace the fixed OSV endpoint.

Start report-only, review signal quality, create a baseline if necessary, and enable enforcement deliberately. See `LIMITATIONS.md` for current analysis boundaries and `PERFORMANCE.md` for measured benchmark evidence.