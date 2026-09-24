#!/usr/bin/env bash
set -euo pipefail
umask 077

usage() {
  cat >&2 <<'EOF'
Usage: scripts/phase12-provider-containment-bundle.sh <httpx|nuclei> [linux-amd64|linux-arm64] [evidence-directory]

Runs the target-free Phase 12 provider host-preparation sequence from one clean
source checkout: deterministic worker build, reviewed artifact staging,
networkless immutable-image preflight, and two-container Linux containment.

This helper does not register a worker, mutate Supabase, contact a production
target, grant target authority, or enable a provider.
EOF
  exit 64
}

[[ $# -ge 1 && $# -le 3 ]] || usage
provider="$1"
platform="${2:-linux-amd64}"

case "$provider" in
  httpx|nuclei) ;;
  *) usage ;;
esac
case "$platform" in
  linux-amd64|linux-arm64) ;;
  *) usage ;;
esac

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source_sha="$(git -C "$repo_root" rev-parse HEAD)"
[[ "$source_sha" =~ ^[a-f0-9]{40}$ ]] || {
  printf 'Unable to determine exact source SHA.\n' >&2
  exit 65
}
[[ -z "$(git -C "$repo_root" status --porcelain)" ]] || {
  printf 'Provider containment bundle requires a clean checkout.\n' >&2
  exit 73
}

for command in git npm node podman sha256sum sed; do
  command -v "$command" >/dev/null 2>&1 || {
    printf 'Required command is unavailable: %s\n' "$command" >&2
    exit 69
  }
done

[[ "$(id -u)" -ne 0 ]] || {
  printf 'Provider containment bundle must run under the dedicated non-root worker account.\n' >&2
  exit 77
}

short_sha="${source_sha:0:12}"
build_root="$repo_root/.scopeforge-provider-build/acceptance-$provider-$platform-$short_sha"
provider_context="$build_root/$provider"
sidecar_context="$build_root/egress-sidecar"
evidence_dir="${3:-$repo_root/.artifacts/phase12-provider-acceptance/$provider-$platform-$short_sha}"

for path in "$build_root" "$evidence_dir"; do
  [[ ! -e "$path" ]] || {
    printf 'Refusing to overwrite existing acceptance path: %s\n' "$path" >&2
    exit 73
  }
done

mkdir -p "$(dirname "$build_root")" "$(dirname "$evidence_dir")"
work_evidence="$(mktemp -d "$(dirname "$evidence_dir")/.phase12-provider-evidence.XXXXXX")"
cleanup() {
  rm -rf -- "$work_evidence"
}
trap cleanup EXIT INT TERM

printf 'Building exact worker bundles from source %s...\n' "$source_sha"
(
  cd "$repo_root"
  npm ci --ignore-scripts --no-audit --no-fund
  npm run build:workers
)

"$repo_root/scripts/phase12-stage-provider-assets.sh" "$provider" "$platform" "$provider_context"
"$repo_root/scripts/phase12-stage-egress-sidecar.sh" "$sidecar_context"

provider_preflight="$("$repo_root/scripts/phase12-provider-host-preflight.sh" "$provider" "$provider_context")"
sidecar_preflight="$("$repo_root/scripts/phase12-provider-host-preflight.sh" egress-sidecar "$sidecar_context")"

printf '%s\n' "$provider_preflight" > "$work_evidence/provider-preflight.txt"
printf '%s\n' "$sidecar_preflight" > "$work_evidence/sidecar-preflight.txt"

provider_image="$(sed -n 's/^PHASE12_PROVIDER_HOST_PREFLIGHT_PASS provider=[^ ]* image=\(.*\)$/\1/p' "$work_evidence/provider-preflight.txt")"
sidecar_image="$(sed -n 's/^PHASE12_PROVIDER_HOST_PREFLIGHT_PASS provider=egress-sidecar image=\(.*\)$/\1/p' "$work_evidence/sidecar-preflight.txt")"
immutable='^localhost/[a-z0-9][a-z0-9._/-]*@sha256:[a-f0-9]{64}$'
[[ "$provider_image" =~ $immutable && "$sidecar_image" =~ $immutable ]] || {
  printf 'Unable to recover immutable image identities from preflight output.\n' >&2
  exit 65
}

[[ -z "$(git -C "$repo_root" status --porcelain)" ]] || {
  printf 'Generated acceptance assets unexpectedly dirtied the source checkout.\n' >&2
  exit 73
}

containment_output="$("$repo_root/scripts/phase12-provider-linux-containment.sh" "$provider" "$provider_image" "$sidecar_image")"
printf '%s\n' "$containment_output" > "$work_evidence/containment.txt"
grep -Fq "PHASE12_PROVIDER_LINUX_CONTAINMENT_PASS provider=$provider source_sha=$source_sha" "$work_evidence/containment.txt" || {
  printf 'Containment helper did not emit the expected exact-source pass marker.\n' >&2
  exit 65
}

cp "$provider_context/STAGING_EVIDENCE.txt" "$work_evidence/provider-staging.txt"
cp "$sidecar_context/STAGING_EVIDENCE.txt" "$work_evidence/sidecar-staging.txt"

{
  printf 'schema_version=1\n'
  printf 'source_sha=%s\n' "$source_sha"
  printf 'provider=%s\n' "$provider"
  printf 'platform=%s\n' "$platform"
  printf 'provider_image=%s\n' "$provider_image"
  printf 'sidecar_image=%s\n' "$sidecar_image"
  printf 'provider_staging_sha256=%s\n' "$(sha256sum "$work_evidence/provider-staging.txt" | awk '{print $1}')"
  printf 'sidecar_staging_sha256=%s\n' "$(sha256sum "$work_evidence/sidecar-staging.txt" | awk '{print $1}')"
  printf 'provider_preflight_sha256=%s\n' "$(sha256sum "$work_evidence/provider-preflight.txt" | awk '{print $1}')"
  printf 'sidecar_preflight_sha256=%s\n' "$(sha256sum "$work_evidence/sidecar-preflight.txt" | awk '{print $1}')"
  printf 'containment_sha256=%s\n' "$(sha256sum "$work_evidence/containment.txt" | awk '{print $1}')"
} > "$work_evidence/ACCEPTANCE_EVIDENCE.txt"

chmod 0444 "$work_evidence"/*.txt
mv -- "$work_evidence" "$evidence_dir"
trap - EXIT INT TERM

printf 'PHASE12_PROVIDER_CONTAINMENT_BUNDLE_PASS provider=%s platform=%s source_sha=%s provider_image=%s sidecar_image=%s evidence=%s\n' \
  "$provider" "$platform" "$source_sha" "$provider_image" "$sidecar_image" "$evidence_dir"
