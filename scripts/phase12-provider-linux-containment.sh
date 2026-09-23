#!/usr/bin/env bash
set -euo pipefail
umask 077

usage() {
  cat >&2 <<'EOF'
Usage: scripts/phase12-provider-linux-containment.sh <httpx|nuclei> <provider-image@sha256:...> <sidecar-image@sha256:...>

Runs a target-free Linux containment check for the Phase 12 two-container
provider boundary. It does not register a worker, mutate Supabase, or contact
an authorized production target. Both images must already exist locally by
immutable digest.
EOF
  exit 64
}

[[ $# -eq 3 ]] || usage
provider="$1"
provider_image="$2"
sidecar_image="$3"

case "$provider" in
  httpx|nuclei) ;;
  *) usage ;;
esac

immutable='^[a-z0-9][a-z0-9._:/-]*@sha256:[a-f0-9]{64}$'
[[ "$provider_image" =~ $immutable && "$sidecar_image" =~ $immutable ]] || {
  printf 'Both images must be lowercase immutable OCI digest references.\n' >&2
  exit 65
}

for command in git node podman sha256sum stat; do
  command -v "$command" >/dev/null 2>&1 || {
    printf 'Required command is unavailable: %s\n' "$command" >&2
    exit 69
  }
done

[[ "$(id -u)" -ne 0 ]] || {
  printf 'Containment acceptance must run under the dedicated non-root worker account.\n' >&2
  exit 77
}
[[ "$(podman info --format '{{.Host.Security.Rootless}}')" == "true" ]] || {
  printf 'Rootless Podman is required.\n' >&2
  exit 77
}
[[ "$(stat -fc %T /sys/fs/cgroup)" == "cgroup2fs" ]] || {
  printf 'Unified cgroup v2 is required.\n' >&2
  exit 77
}

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source_sha="$(git -C "$repo_root" rev-parse HEAD)"
[[ "$source_sha" =~ ^[a-f0-9]{40}$ ]] || {
  printf 'Unable to determine the exact source SHA.\n' >&2
  exit 65
}
[[ -z "$(git -C "$repo_root" status --porcelain)" ]] || {
  printf 'Containment acceptance requires a clean checkout.\n' >&2
  exit 73
}

inspect_digest() {
  local image="$1"
  local expected="${image##*@}"
  local actual
  actual="$(podman image inspect --format '{{.Digest}}' "$image" 2>/dev/null)" || {
    printf 'Immutable image is not available locally: %s\n' "$image" >&2
    exit 66
  }
  [[ "$actual" == "$expected" ]] || {
    printf 'Local image digest does not match immutable reference: %s\n' "$image" >&2
    exit 65
  }
}

inspect_digest "$provider_image"
inspect_digest "$sidecar_image"

runtime_root="/run/scopeforge-worker/egress"
mkdir -p "$runtime_root"
chmod 0700 "$runtime_root"
[[ ! -L "$runtime_root" && -d "$runtime_root" && "$(stat -c %u "$runtime_root")" == "$(id -u)" ]] || {
  printf 'Provider egress runtime root is not private and worker-owned.\n' >&2
  exit 77
}

token="$(printf '%s' "$source_sha:$provider:$$" | sha256sum | awk '{print $1}')"
socket_path="$runtime_root/$token.sock"
nonce="$(printf '%064d' 0 | tr '0' 'a')"
sidecar_name="scopeforge-accept-sidecar-${token:0:16}"
provider_name="scopeforge-accept-$provider-${token:0:16}"
socket_pid=""

cleanup() {
  podman rm --time=0 --force --ignore "$provider_name" >/dev/null 2>&1 || true
  podman rm --time=0 --force --ignore "$sidecar_name" >/dev/null 2>&1 || true
  if [[ -n "$socket_pid" ]]; then
    kill "$socket_pid" >/dev/null 2>&1 || true
    wait "$socket_pid" >/dev/null 2>&1 || true
  fi
  rm -f -- "$socket_path"
}
trap cleanup EXIT INT TERM

node - "$socket_path" <<'NODE' &
const net = require("node:net");
const socketPath = process.argv[2];
const server = net.createServer((socket) => socket.destroy());
server.listen(socketPath);
const close = () => server.close(() => process.exit(0));
process.on("SIGTERM", close);
process.on("SIGINT", close);
NODE
socket_pid="$!"

for _ in $(seq 1 40); do
  [[ -S "$socket_path" ]] && break
  sleep 0.05
done
[[ -S "$socket_path" ]] || {
  printf 'Unable to create the supervisor-owned Unix socket fixture.\n' >&2
  exit 70
}
chmod 0666 "$socket_path"

common=(
  --pull=never
  --read-only
  --read-only-tmpfs=false
  --cap-drop=all
  --security-opt=no-new-privileges
  --memory=256m
  --cgroup-conf=memory.swap.max=0
  --cpus=0.5
  --log-driver=none
  --user=65532:65532
  --unsetenv-all
  --tmpfs=/tmp:rw,size=8388608,mode=1777,nosuid,nodev,noexec
)

podman create \
  --name "$sidecar_name" \
  "${common[@]}" \
  --network=none \
  --pids-limit=8 \
  --mount="type=bind,src=$socket_path,dst=/run/scopeforge/egress.sock,ro" \
  "$sidecar_image" \
  --trusted-hostname example.com \
  --port 443 \
  --session-nonce "$nonce" >/dev/null

podman start "$sidecar_name" >/dev/null

ready_probe='
const net=require("node:net");
const s=net.connect({host:"127.0.0.1",port:17777});
s.setTimeout(250);
s.once("connect",()=>{s.destroy();process.exit(0)});
s.once("timeout",()=>{s.destroy();process.exit(2)});
s.once("error",()=>process.exit(3));
'
ready=0
for _ in $(seq 1 30); do
  if podman exec "$sidecar_name" /usr/local/bin/node -e "$ready_probe" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 0.05
done
[[ "$ready" -eq 1 ]] || {
  printf 'Trusted egress sidecar did not become ready.\n' >&2
  exit 70
}

sidecar_network="$(podman inspect --format '{{.HostConfig.NetworkMode}}' "$sidecar_name")"
sidecar_id="$(podman inspect --format '{{.Id}}' "$sidecar_name")"
[[ "$sidecar_id" =~ ^[a-f0-9]{12,64}$ ]] || {
  printf 'Trusted sidecar container identity is invalid.\n' >&2
  exit 65
}
[[ "$sidecar_network" == "none" ]] || {
  printf 'Trusted sidecar unexpectedly has an ordinary network.\n' >&2
  exit 65
}

probe='
const dns=require("node:dns");
const fs=require("node:fs");
const net=require("node:net");
const results={dnsBlocked:false,publicTcpBlocked:false,metadataBlocked:false,loopbackProxy:false,socketAbsent:false,engineSocketAbsent:false};
let pending=4;
let failed=false;
function done(){pending-=1;if(pending===0){results.socketAbsent=!fs.existsSync("/run/scopeforge/egress.sock");results.engineSocketAbsent=!fs.existsSync("/run/podman/podman.sock")&&!fs.existsSync("/var/run/docker.sock");const ok=Object.values(results).every(Boolean);process.stdout.write(JSON.stringify(results)+"\n");process.exit(ok&&!failed?0:9)}}
dns.lookup("example.com",(error)=>{results.dnsBlocked=Boolean(error);done()});
function denied(host,port,key){const s=net.connect({host,port});s.setTimeout(400);s.once("connect",()=>{failed=true;s.destroy();done()});s.once("timeout",()=>{results[key]=true;s.destroy();done()});s.once("error",()=>{results[key]=true;done()})}
denied("1.1.1.1",443,"publicTcpBlocked");
denied("169.254.169.254",80,"metadataBlocked");
const loop=net.connect({host:"127.0.0.1",port:17777});loop.setTimeout(400);loop.once("connect",()=>{results.loopbackProxy=true;loop.destroy();done()});loop.once("timeout",()=>{loop.destroy();done()});loop.once("error",()=>done());
setTimeout(()=>process.exit(10),2500).unref();
'

podman create \
  --name "$provider_name" \
  "${common[@]}" \
  --pids-limit=32 \
  --network="container:$sidecar_name" \
  --entrypoint=/usr/local/bin/node \
  "$provider_image" \
  -e "$probe" >/dev/null

provider_network="$(podman inspect --format '{{.HostConfig.NetworkMode}}' "$provider_name")"
case "$provider_network" in
  "container:$sidecar_name"|"container:$sidecar_id") ;;
  *)
    printf 'Provider did not join only the trusted sidecar network namespace.\n' >&2
    exit 65
    ;;
esac

if ! provider_output="$(podman start --attach "$provider_name" 2>&1)"; then
  provider_exit="$(podman wait "$provider_name" 2>/dev/null || true)"
  printf 'Provider containment probe failed: exit=%s output=%s\n' "$provider_exit" "$provider_output" >&2
  exit 65
fi
provider_exit="$(podman wait "$provider_name")"
[[ "$provider_exit" == "0" ]] || {
  printf 'Provider containment probe returned inconsistent exit status: %s\n' "$provider_exit" >&2
  exit 65
}

if podman exec "$sidecar_name" /usr/local/bin/node -e 'process.exit(require("node:fs").existsSync("/run/scopeforge/egress.sock")?0:2)' >/dev/null 2>&1; then
  :
else
  printf 'Trusted sidecar cannot see the task Unix socket.\n' >&2
  exit 65
fi

printf 'PHASE12_PROVIDER_LINUX_CONTAINMENT_PASS provider=%s source_sha=%s provider_image=%s sidecar_image=%s probe=%s\n'   "$provider" "$source_sha" "$provider_image" "$sidecar_image" "$provider_output"
