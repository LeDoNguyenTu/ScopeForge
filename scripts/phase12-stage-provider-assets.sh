#!/usr/bin/env bash
set -euo pipefail
umask 077

usage() {
  cat >&2 <<'EOF'
Usage: scripts/phase12-stage-provider-assets.sh <httpx|nuclei> [linux-amd64|linux-arm64] [destination]

Creates a new verified provider build context without executing the downloaded provider.
The destination must not already exist.
EOF
  exit 64
}

[[ $# -ge 1 && $# -le 3 ]] || usage

provider="$1"
platform="${2:-linux-amd64}"
case "$platform" in
  linux-amd64|linux-arm64) ;;
  *) usage ;;
esac

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
destination="${3:-$repo_root/.scopeforge-provider-build/$provider-$platform}"

for command in curl git node sha256sum unzip; do
  command -v "$command" >/dev/null 2>&1 || {
    printf 'Required command is unavailable: %s\n' "$command" >&2
    exit 69
  }
done

if [[ -e "$destination" ]]; then
  printf 'Refusing to overwrite existing provider staging directory: %s\n' "$destination" >&2
  exit 73
fi

case "$provider" in
  httpx)
    manifest="$repo_root/deploy/worker/httpx-artifact-manifest.json"
    binary_name="httpx"
    worker_entry="$repo_root/.scopeforge-worker-build/httpx-worker-entry.js"
    containerfile="$repo_root/deploy/worker/Containerfile.httpx"
    ;;
  nuclei)
    manifest="$repo_root/deploy/worker/nuclei-artifact-manifest.json"
    binary_name="nuclei"
    worker_entry="$repo_root/.scopeforge-worker-build/nuclei-worker-entry.js"
    containerfile="$repo_root/deploy/worker/Containerfile.nuclei"
    ;;
  *)
    usage
    ;;
esac

[[ -f "$manifest" ]] || {
  printf 'Provider manifest is missing: %s\n' "$manifest" >&2
  exit 66
}
[[ -f "$worker_entry" ]] || {
  printf 'Worker bundle is missing. Run npm run build:workers first.\n' >&2
  exit 66
}
[[ -f "$containerfile" ]] || {
  printf 'Provider Containerfile is missing: %s\n' "$containerfile" >&2
  exit 66
}

manifest_value() {
  local selector="$1"
  node - "$manifest" "$platform" "$selector" <<'NODE'
const fs = require("node:fs");
const [manifestPath, platform, selector] = process.argv.slice(2);
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const artifact = manifest.artifacts?.[platform];
if (!artifact) process.exit(2);
const values = {
  url: artifact.url,
  name: artifact.name,
  sha256: artifact.sha256,
  templateCommit: manifest.templates?.sourceCommit,
  templatePath: manifest.templates?.initialAllowlist?.[0]?.path,
  templateBlob: manifest.templates?.initialAllowlist?.[0]?.gitBlobSha,
};
const value = values[selector];
if (typeof value !== "string" || value.length === 0) process.exit(3);
process.stdout.write(value);
NODE
}

artifact_url="$(manifest_value url)"
artifact_name="$(manifest_value name)"
expected_sha256="$(manifest_value sha256)"

case "$artifact_url" in
  https://github.com/projectdiscovery/*/releases/download/*) ;;
  *)
    printf 'Provider artifact URL is outside the reviewed GitHub release boundary.\n' >&2
    exit 65
    ;;
esac
[[ "$expected_sha256" =~ ^[a-f0-9]{64}$ ]] || {
  printf 'Provider artifact SHA-256 is invalid.\n' >&2
  exit 65
}

parent="$(dirname "$destination")"
mkdir -p "$parent"
staging="$(mktemp -d "$parent/.phase12-stage.XXXXXX")"
cleanup() {
  rm -rf -- "$staging"
}
trap cleanup EXIT

archive="$staging/$artifact_name"
curl   --fail   --location   --proto '=https'   --tlsv1.2   --retry 3   --retry-all-errors   --silent   --show-error   --output "$archive"   "$artifact_url"

actual_sha256="$(sha256sum "$archive" | awk '{print $1}')"
if [[ "$actual_sha256" != "$expected_sha256" ]]; then
  printf 'Provider artifact checksum mismatch.\n' >&2
  exit 65
fi

if ! unzip -Z1 "$archive" | grep -Fxq "$binary_name"; then
  printf 'Provider archive does not contain the expected root binary: %s\n' "$binary_name" >&2
  exit 65
fi
unzip -p "$archive" "$binary_name" > "$staging/$binary_name"
chmod 0555 "$staging/$binary_name"

cp "$worker_entry" "$staging/${provider}-worker-entry.js"
cp "$containerfile" "$staging/Containerfile"

if [[ "$provider" == "nuclei" ]]; then
  template_commit="$(manifest_value templateCommit)"
  template_path="$(manifest_value templatePath)"
  expected_blob="$(manifest_value templateBlob)"
  [[ "$template_commit" =~ ^[a-f0-9]{40}$ && "$expected_blob" =~ ^[a-f0-9]{40}$ ]] || {
    printf 'Pinned Nuclei template identity is invalid.\n' >&2
    exit 65
  }
  case "$template_path" in
    http/*.yaml) ;;
    *)
      printf 'Pinned Nuclei template path is outside the reviewed HTTP template boundary.\n' >&2
      exit 65
      ;;
  esac

  template_file="$staging/nuclei-template-http-missing-security-headers.yaml"
  template_url="https://raw.githubusercontent.com/projectdiscovery/nuclei-templates/$template_commit/$template_path"
  curl     --fail     --location     --proto '=https'     --tlsv1.2     --retry 3     --retry-all-errors     --silent     --show-error     --output "$template_file"     "$template_url"

  actual_blob="$(git hash-object "$template_file")"
  if [[ "$actual_blob" != "$expected_blob" ]]; then
    printf 'Nuclei template Git blob identity mismatch.\n' >&2
    exit 65
  fi
  chmod 0444 "$template_file"
fi

rm -f -- "$archive"

{
  printf 'provider=%s\n' "$provider"
  printf 'platform=%s\n' "$platform"
  printf 'artifact_sha256=%s\n' "$actual_sha256"
  printf 'binary_sha256=%s\n' "$(sha256sum "$staging/$binary_name" | awk '{print $1}')"
  printf 'worker_entry_sha256=%s\n' "$(sha256sum "$staging/${provider}-worker-entry.js" | awk '{print $1}')"
  if [[ "$provider" == "nuclei" ]]; then
    printf 'template_git_blob=%s\n' "$(git hash-object "$staging/nuclei-template-http-missing-security-headers.yaml")"
    printf 'template_sha256=%s\n' "$(sha256sum "$staging/nuclei-template-http-missing-security-headers.yaml" | awk '{print $1}')"
  fi
} > "$staging/STAGING_EVIDENCE.txt"
chmod 0444 "$staging/STAGING_EVIDENCE.txt"

mv -- "$staging" "$destination"
trap - EXIT

printf 'PHASE12_PROVIDER_STAGING_PASS provider=%s platform=%s destination=%s\n'   "$provider" "$platform" "$destination"
