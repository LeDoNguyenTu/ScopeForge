#!/usr/bin/env bash
set -euo pipefail

TASK_ID="${1:-}"
ATTEMPT_ID="${2:-}"

uuid_re='^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
if [[ ! "${TASK_ID}" =~ ${uuid_re} ]] || [[ ! "${ATTEMPT_ID}" =~ ${uuid_re} ]]; then
  echo "usage: phase11-final-host-check.sh <task-uuid> <attempt-uuid>" >&2
  exit 64
fi

SERVICE='scopeforge-worker@phase11-http.service'
RUNTIME_DIR='/run/scopeforge-worker'
MEDIATOR_DIR='/run/scopeforge-worker/mediator'
EXPECTED_IMAGE='localhost/scopeforge-runtime-worker@sha256:dd3014df27dd6d560b78ed6bdab9081a7da3648604dfdc44c6b35f9246de1c2a'
CONTAINER_NAME="scopeforge-runtime-${TASK_ID}-${ATTEMPT_ID}"

echo '== service =='
sudo systemctl is-active --quiet "${SERVICE}"
sudo systemctl show "${SERVICE}" --property=ActiveState --property=SubState --property=ExecMainStatus --no-pager

echo '== immutable runtime image =='
sudo -u scopeforge-worker env   HOME=/home/scopeforge-worker   XDG_RUNTIME_DIR="${RUNTIME_DIR}"   /usr/bin/podman image exists "${EXPECTED_IMAGE}"

echo '== final canary container cleanup =='
container_rows="$(
  sudo -u scopeforge-worker env     HOME=/home/scopeforge-worker     XDG_RUNTIME_DIR="${RUNTIME_DIR}"     /usr/bin/podman ps -a       --filter "name=^${CONTAINER_NAME}$"       --format '{{.ID}} {{.Names}} {{.Status}} {{.Image}}'
)"
if [[ -n "${container_rows}" ]]; then
  echo "FAIL: final canary container still exists:" >&2
  printf '%s\n' "${container_rows}" >&2
  exit 70
fi
echo "PASS: no remaining container named ${CONTAINER_NAME}"

echo '== mediator socket cleanup =='
if [[ -d "${MEDIATOR_DIR}" ]]; then
  mapfile -t sockets < <(sudo find "${MEDIATOR_DIR}" -maxdepth 1 -type s -print)
else
  sockets=()
fi
if (( ${#sockets[@]} > 0 )); then
  echo 'FAIL: mediator socket(s) remain:' >&2
  printf '%s\n' "${sockets[@]}" >&2
  exit 71
fi
echo 'PASS: no remaining mediator sockets'

echo '== bounded recent worker events =='
sudo journalctl   -u "${SERVICE}"   --since '-20 minutes'   --no-pager   -n 300   | grep -E 'worker_runtime_started|worker_iteration_completed|worker_iteration_stage_failed|runtime|phase11'   | tail -n 120 || true

echo 'PHASE11_HOST_CLEANUP_PASS'
