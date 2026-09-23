#!/usr/bin/env bash
set -euo pipefail
umask 077

usage() {
  cat >&2 <<'EOF'
Usage: scripts/phase12-stage-egress-sidecar.sh [destination]

Creates a new verified build context for the ScopeForge Phase 12 egress sidecar.
The destination must not already exist. No network access is performed.
EOF
  exit 64
}

[[ $# -le 1 ]] || usage

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
destination="${1:-$repo_root/.scopeforge-provider-build/egress-sidecar}"
entry="$repo_root/.scopeforge-worker-build/provider-egress-sidecar-entry.js"
containerfile="$repo_root/deploy/worker/Containerfile.provider-egress-sidecar"

for command in sha256sum; do
  command -v "$command" >/dev/null 2>&1 || {
    printf 'Required command is unavailable: %s\n' "$command" >&2
    exit 69
  }
done

[[ -f "$entry" ]] || {
  printf 'Sidecar bundle is missing. Run npm run build:workers first.\n' >&2
  exit 66
}
[[ -f "$containerfile" ]] || {
  printf 'Sidecar Containerfile is missing: %s\n' "$containerfile" >&2
  exit 66
}
if [[ -e "$destination" ]]; then
  printf 'Refusing to overwrite existing sidecar staging directory: %s\n' "$destination" >&2
  exit 73
fi

parent="$(dirname "$destination")"
mkdir -p "$parent"
staging="$(mktemp -d "$parent/.phase12-sidecar-stage.XXXXXX")"
cleanup() {
  rm -rf -- "$staging"
}
trap cleanup EXIT

cp "$entry" "$staging/provider-egress-sidecar-entry.js"
cp "$containerfile" "$staging/Containerfile"
chmod 0444 "$staging/provider-egress-sidecar-entry.js" "$staging/Containerfile"

{
  printf 'provider=egress-sidecar\n'
  printf 'entry_sha256=%s\n' "$(sha256sum "$staging/provider-egress-sidecar-entry.js" | awk '{print $1}')"
  printf 'containerfile_sha256=%s\n' "$(sha256sum "$staging/Containerfile" | awk '{print $1}')"
} > "$staging/STAGING_EVIDENCE.txt"
chmod 0444 "$staging/STAGING_EVIDENCE.txt"

mv -- "$staging" "$destination"
trap - EXIT

printf 'PHASE12_SIDECAR_STAGING_PASS destination=%s\n' "$destination"
