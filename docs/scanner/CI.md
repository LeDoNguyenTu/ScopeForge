# ScopeForge in GitHub Actions

ScopeForge Phase 3 is local and CI-first. A scan does not require a ScopeForge account or hosted service.

## Current installation status

ScopeForge is not yet published as a standalone npm package or reusable GitHub Action. Until a versioned distribution exists, install the tool from source in an isolated tool directory outside the target repository workspace.

For CI safety and reproducibility:

- pin ScopeForge to a reviewed commit SHA when possible instead of following `main`
- install ScopeForge's own dependencies with lifecycle scripts disabled using `npm ci --ignore-scripts`
- build the ScopeForge CLI in the isolated tool directory
- scan the target repository by passing `$GITHUB_WORKSPACE` explicitly
- do not run `npm install`, lifecycle scripts, tests, builds, Docker, Terraform, kubectl, Helm, Kustomize, or workflows from the target repository as part of ScopeForge scanning

## Report-only scan with SARIF upload

The example below prints developer-readable terminal output, generates SARIF, and uploads the SARIF file to GitHub Code Scanning. Findings do not fail the job unless the repository configuration itself enables `failOn`.

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
    env:
      SCOPEFORGE_REF: main # Prefer a reviewed commit SHA for reproducible use.
    steps:
      - name: Checkout target repository
        uses: actions/checkout@v4

      - name: Install ScopeForge in an isolated tool directory
        shell: bash
        run: |
          set -euo pipefail
          SCOPEFORGE_DIR="$RUNNER_TEMP/scopeforge-tool"
          git clone https://github.com/LeDoNguyenTu/ScopeForge.git "$SCOPEFORGE_DIR"
          git -C "$SCOPEFORGE_DIR" checkout "$SCOPEFORGE_REF"
          npm --prefix "$SCOPEFORGE_DIR" ci --ignore-scripts --no-audit --no-fund
          npm --prefix "$SCOPEFORGE_DIR" run build:cli

      - name: ScopeForge terminal report
        shell: bash
        run: |
          node "$RUNNER_TEMP/scopeforge-tool/.scopeforge-build/packages/cli/index.js" \
            scan "$GITHUB_WORKSPACE"

      - name: Generate ScopeForge SARIF
        shell: bash
        run: |
          node "$RUNNER_TEMP/scopeforge-tool/.scopeforge-build/packages/cli/index.js" \
            scan "$GITHUB_WORKSPACE" \
            --format sarif \
            --output "$RUNNER_TEMP/scopeforge.sarif"

      - name: Upload ScopeForge SARIF
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: ${{ runner.temp }}/scopeforge.sarif
```

`security-events: write` must be available and GitHub Code Scanning must be enabled for the repository. GitHub can restrict this permission for some forked pull-request contexts. If upload permission is unavailable, omit the upload step and keep ScopeForge's local terminal, JSON, or SARIF artifacts instead.

The example performs two local scans because the current CLI emits one primary format per invocation. The first provides human terminal output and the second creates SARIF. Both scans remain passive and do not execute the target repository.

## Optional severity enforcement

Enforcement is explicit. For example, to fail when a high or critical finding is in policy scope:

```yaml
- name: Enforce new high-severity findings
  shell: bash
  run: |
    node "$RUNNER_TEMP/scopeforge-tool/.scopeforge-build/packages/cli/index.js" \
      scan "$GITHUB_WORKSPACE" \
      --baseline .scopeforge-baseline.json \
      --fail-on high
```

Without a baseline, `--fail-on high` gates on all findings. With a baseline, the default baseline gate is `new`, so accepted existing findings stay visible but do not fail policy. Use `--baseline-gate all` when the repository intentionally wants existing and new findings in the gate.

Repository configuration can also set `failOn`, `baseline`, `baselineGate`, enabled scanners, rule selection, safe budget tightening, OSV opt-in, and output settings. Configuration is read only from the explicit scan root as `.scopeforge.json`.

## Baseline workflow

Create a baseline from the current repository state:

```bash
node /path/to/scopeforge/.scopeforge-build/packages/cli/index.js baseline create .
```

This writes `.scopeforge-baseline.json` in the scan root. The baseline stores stable finding identities and safe metadata only. It does not store raw detected secret values, source snippets, arbitrary finding metadata, or remediation text.

Use it during scans:

```bash
node /path/to/scopeforge/.scopeforge-build/packages/cli/index.js \
  scan . \
  --baseline .scopeforge-baseline.json \
  --fail-on high
```

Commit a baseline only after review, using the same change-control expectations as other security policy files.

## JSON, SARIF, and SBOM artifacts

Native JSON:

```bash
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

Normal scan output and SBOM output must use different paths. Existing output symlinks are refused. Repository-configured output paths must remain canonical relative paths inside the scan root.

Optional artifact upload can use GitHub's standard artifact action after generation:

```yaml
- name: Upload ScopeForge artifacts
  uses: actions/upload-artifact@v4
  with:
    name: scopeforge-results
    path: |
      ${{ runner.temp }}/scopeforge.sarif
      ${{ runner.temp }}/scopeforge.cdx.json
```

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

When enabled, ScopeForge sends only normalized npm package identity and exact version to its fixed OSV endpoint. It does not send repository source files, arbitrary target configuration, or detected secret values to OSV. A lookup failure is reported as a scanner error and is never represented as a clean vulnerability result.

## Exit codes

ScopeForge uses distinct process exit codes:

| Code | Meaning |
|---:|---|
| 0 | Successful scan. Findings are allowed by the active policy. |
| 1 | Policy failed, for example `--fail-on high` matched an in-scope finding. |
| 2 | CLI usage, configuration, baseline, or unsafe-output error. |
| 3 | Scanner execution or incomplete-analysis error. |

A report-only scan with findings returns 0. Scanner errors return 3 so incomplete coverage cannot look like a clean scan.

## Recommended CI policy

Start report-only and review output quality. Then create a reviewed baseline if the repository has accepted legacy findings. Add `--fail-on` only after the team understands the current signal and false-negative boundaries documented in `LIMITATIONS.md`.

Do not treat ScopeForge Phase 3 as a replacement for authorization, runtime testing, manual review, cloud posture tooling, or organization-specific security controls.
