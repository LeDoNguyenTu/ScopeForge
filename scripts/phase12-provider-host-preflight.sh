#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat >&2 <<'EOF'
Usage: scripts/phase12-provider-host-preflight.sh <httpx|nuclei> <staged-build-context>

Builds and checks a default-off Phase 12 provider image under the networkless
baseline. It does not register a worker, change production state, or contact a target.
EOF
  exit 64
}

[[ $# -eq 2 ]] || usage
provider="$1"
context="$2"

case "$provider" in
  httpx)
    image_name="scopeforge-httpx-worker"
    binary="/opt/scopeforge/bin/httpx"
    expected_version="1.12.0"
    version_args=(-version)
    ;;
  nuclei)
    image_name="scopeforge-nuclei-worker"
    binary="/opt/scopeforge/bin/nuclei"
    expected_version="3.11.1"
    version_args=(-version -duc)
    ;;
  *)
    usage
    ;;
esac

for command in podman sha256sum; do
  command -v "$command" >/dev/null 2>&1 || {
    printf 'Required command is unavailable: %s\n' "$command" >&2
    exit 69
  }
done

[[ "$(id -u)" -ne 0 ]] || {
  printf 'Phase 12 provider acceptance must run under the dedicated non-root worker account.\n' >&2
  exit 77
}
[[ -d "$context" && -f "$context/Containerfile" && -f "$context/STAGING_EVIDENCE.txt" ]] || {
  printf 'Verified provider staging context is incomplete.\n' >&2
  exit 66
}
grep -Fxq "provider=$provider" "$context/STAGING_EVIDENCE.txt" || {
  printf 'Provider staging evidence does not match the requested provider.\n' >&2
  exit 65
}

rootless="$(podman info --format '{{.Host.Security.Rootless}}')"
[[ "$rootless" == "true" ]] || {
  printf 'Rootless Podman is required.\n' >&2
  exit 77
}
[[ "$(stat -fc %T /sys/fs/cgroup)" == "cgroup2fs" ]] || {
  printf 'Unified cgroup v2 is required.\n' >&2
  exit 77
}

candidate="localhost/$image_name:phase12-candidate"
podman build   --network=none   --pull=never   --file "$context/Containerfile"   --tag "$candidate"   "$context"

digest="$(podman image inspect --format '{{.Digest}}' "$candidate")"
[[ "$digest" =~ ^sha256:[a-f0-9]{64}$ ]] || {
  printf 'Built provider image did not expose an immutable digest.\n' >&2
  exit 65
}
immutable="localhost/$image_name@$digest"

sandbox=(
  --rm
  --pull=never
  --network=none
  --read-only
  --cap-drop=ALL
  --security-opt=no-new-privileges
  --pids-limit=8
  --memory=268435456
  --memory-swap=268435456
  --cpus=0.5
  --tmpfs=/tmp:rw,nosuid,nodev,noexec,size=8388608
)

version_output="$(podman run "${sandbox[@]}" --entrypoint "$binary" "$immutable" "${version_args[@]}" 2>&1)"
grep -Fq "$expected_version" <<<"$version_output" || {
  printf 'Provider binary version did not match the reviewed release.\n' >&2
  exit 65
}

network_probe='
const net = require("node:net");
const dns = require("node:dns");
let pending = 2;
let failed = false;
const finish = () => {
  pending -= 1;
  if (pending === 0) process.exit(failed ? 2 : 0);
};
const socket = net.connect({host: "1.1.1.1", port: 443});
socket.setTimeout(1500);
socket.once("connect", () => { failed = true; socket.destroy(); finish(); });
socket.once("timeout", () => { socket.destroy(); finish(); });
socket.once("error", () => finish());
dns.lookup("example.com", (error) => {
  if (!error) failed = true;
  finish();
});
setTimeout(() => process.exit(3), 2500).unref();
'

podman run "${sandbox[@]}"   --entrypoint /usr/local/bin/node   "$immutable"   -e "$network_probe"

printf 'PHASE12_PROVIDER_HOST_PREFLIGHT_PASS provider=%s image=%s\n'   "$provider" "$immutable"
