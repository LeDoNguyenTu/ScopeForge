# Phase 11 single Codex run closure

Last prepared: 2026-09-22, Asia/Singapore.

> **Consumed on 2026-09-22:** this run queued its one authorized canary. Do not reuse this document to queue a second canary in the same run. The canary's worker/action path succeeded, but the parent run exposed the clean request-budget terminal-status defect documented in `CODEX_HANDOFF_PHASE11.md`. Release that fix first; a new canary requires a separately authorized future run.

This is the shortest safe path to finish Phase 11 in one Codex run. Do not spend the run rediscovering already-verified state. Do not redesign worker-table RLS during this closure: PR #180 proved the current `postgres` RPC owner has `BYPASSRLS`, so that defense-in-depth redesign is explicitly post-Phase-11 work.

## Original goal for the consumed run

The 2026-09-22 run attempted the one remaining authenticated production canary, collected database/Vercel/Oracle evidence, and was required to close Phase 11 only if every acceptance criterion passed. It did not pass the parent-run completion check; use the current handoff rather than repeating this procedure in the same run.

Current estimates before this run:

- Phase 11 source: 100%
- Phase 11 operational acceptance: about 94%
- overall Phase 11 completion task: about 98%
- whole ScopeForge project: about 90%

The expected successful outcome of this run is Phase 11 source 100%, operational acceptance 100%, and Phase 11 completion task 100%.

## Fixed production identities

- repository: `LeDoNguyenTu/ScopeForge`
- ScopeForge Supabase: `tdgpibrepzcvdivztkta`
- never use Job Command Center Supabase: `xwsergbpvkcsugexssmc`
- worker ID: `cd9a7769-e21f-4f75-84c3-ffe2d1f4616e`
- execution class: `phase11_http_discovery_v1`
- verified target shown in the admin UI: `ScopeForge Production · https://scopeforge.dev`
- verified asset ID: `587635f1-a8f5-4e42-aeca-693c3d0e42eb`
- verified asset workspace: `4af09b34-c75f-43ba-985e-19add2a1a749`
- Oracle host: `ubuntu@168.107.81.228`
- SSH key on the known Windows workstation: `C:\Users\ADMIN\.ssh\ssh-key-2026-08-31.key.txt`
- OpenSSH executable: `C:\Windows\System32\OpenSSH\ssh.exe`
- accepted immutable image: `localhost/scopeforge-runtime-worker@sha256:dd3014df27dd6d560b78ed6bdab9081a7da3648604dfdc44c6b35f9246de1c2a`

Do not print secret values, environment files, cookies, authorization headers, worker credentials, service-role keys, or full environment dumps.

## One-run procedure

### A. Synchronize without destroying local work

1. Work from `D:\PROJECTS\ScopeForge`.
2. Inspect `git status --short --branch`, fetch/prune, and resolve current `origin/main`.
3. Do not reset or discard unrelated uncommitted user work.
4. If the main worktree is not clean, create a temporary clean worktree from `origin/main` for this closure.
5. Confirm there is no unexpected open Phase 11 PR and no newer runtime-changing Phase 11 commit that invalidates this runbook.
6. Read this file plus `docs/development/CODEX_HANDOFF_PHASE11.md`.

### B. Preflight production state

Run the read-only `scripts/phase11-final-preflight.sql` against ScopeForge Supabase first. Use live provider state, not stale docs.

Require before clicking anything:

- for the next separately authorized run, the preflight result shows `phase11_task_count = 4`, `active_phase11_task_count = 0`, worker `disabled_at = null`, and eligible target `ScopeForge Production` at `https://scopeforge.dev`
- the intended current main Vercel deployment is READY
- ScopeForge Supabase project is `tdgpibrepzcvdivztkta`
- worker `cd9a7769-e21f-4f75-84c3-ffe2d1f4616e` is enabled
- there are exactly the four historical Phase 11 tasks/runs and zero active queued/retry_wait/leased Phase 11 tasks
- fresh production worker claims are HTTP 200
- `https://scopeforge.dev/.well-known/scopeforge-verification.txt` still returns the expected proof before the canary

Do not queue a canary if an unexpected active Phase 11 task already exists.

### C. Run exactly one authenticated canary

Use the connected authenticated Chrome extension/session. Do not use whole-desktop automation.

1. Open `https://scopeforge.dev/admin/phase11`.
2. Confirm the page says:
   - `Phase 11 operations`
   - `Bounded production canary`
   - verified asset only
   - root only
   - GET
   - redirects disabled
   - request ceiling 1
   - runtime ceiling 5 seconds
3. In **Verified target**, select exactly:
   `ScopeForge Production · https://scopeforge.dev`
4. Click **Run bounded canary exactly once**.
5. Never click the button again during this run, even if the result is delayed or failed.
6. Record the displayed:
   - Run ID
   - Action ID

If the UI reports a queue error, capture it and debug the single failed canary. Do not create a second canary.

### D. Collect authoritative database evidence

Run the read-only SQL file:

`scripts/phase11-final-evidence.sql`

It excludes the four preserved terminal canaries and therefore selects only a newly authorized later canary.

The result includes `acceptance_ready` plus individual `acceptance_checks`. Do not close Phase 11 unless `acceptance_ready = true` and the independent Vercel/Oracle secrecy and cleanup checks also pass.

From the result, record:

- run ID/status/stop reason
- action ID/state/decision/max request/max runtime
- task ID/state/attempt count
- worker attempt ID/outcome/failure code/timing/resource metrics
- action attempt status/error/request_count/observation IDs/evidence refs
- coverage request_count/provider_failure_count
- observations, if any
- worker enabled state/last_seen_at
- active Phase 11 task count

Cross-check the database Run and Action IDs against the IDs shown by the admin UI. They must match.

Do not edit, retry, delete, or rewrite any failed canary rows.

### E. Require the Phase 11 acceptance conditions

All of these must be true to close Phase 11:

- the new task was leased by the dedicated Phase 11 worker
- preparation passed the former HTTP 409 boundary
- normal mediator/sandbox execution occurred
- exactly one request was charged
- worker attempt reached a legitimate terminal result
- action attempt reached a legitimate terminal result
- run/action/task reconciled terminally
- coverage request_count is exactly 1 for this run
- no duplicate terminal accounting occurred
- either a valid observation exists or the provider has a legitimate no-signal success result
- no out-of-scope redirect or target authority was used
- no response body, credential, authorization token, cookie, or secret appears in ordinary evidence/logs

A manufactured finding is not required and must not be created.

### F. Verify Vercel server-side evidence

Inspect production runtime logs for the new Run/Action/Task/Attempt window.

Require:

- worker claim succeeded
- `/api/internal/workers/phase11-http/prepare` no longer returns the historical HTTP 409 for the final attempt
- expected finalization completes
- no new application-error cluster attributable to the successful canary
- ordinary logs do not contain response bodies, credentials, auth tokens, cookies, worker secrets, or service-role keys

Do not paste secret-bearing raw headers or environment values into docs.

### G. Verify Oracle host cleanup

Copy `scripts/phase11-final-host-check.sh` to the Oracle host or pipe it over SSH, then execute it with the final Task UUID and Worker Attempt UUID.

PowerShell/OpenSSH has previously been most reliable with the full executable path and stop-parsing syntax, for example after replacing the UUID placeholders with literal values:

```powershell
C:\Windows\System32\OpenSSH\scp.exe --% -i C:\Users\ADMIN\.ssh\ssh-key-2026-08-31.key.txt -o BatchMode=yes -o StrictHostKeyChecking=yes scripts\phase11-final-host-check.sh ubuntu@168.107.81.228:/tmp/phase11-final-host-check.sh

C:\Windows\System32\OpenSSH\ssh.exe --% -i C:\Users\ADMIN\.ssh\ssh-key-2026-08-31.key.txt -o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=12 ubuntu@168.107.81.228 bash /tmp/phase11-final-host-check.sh <TASK_UUID> <WORKER_ATTEMPT_UUID>
```

Require final output:

`PHASE11_HOST_CLEANUP_PASS`

The helper checks:

- systemd service active
- immutable accepted runtime image present
- no remaining exact final-canary `scopeforge-runtime-<task>-<attempt>` container
- no remaining mediator Unix socket under `/run/scopeforge-worker/mediator`
- bounded recent worker event lines only

Do not inspect or print `/etc/scopeforge/workers/*.env`.

### H. If the canary succeeds, close Phase 11 in the same Codex run

Create a closure branch from current `origin/main`.

Update at minimum:

- `docs/development/CURRENT_STATE.md`
- `docs/development/UNFINISHED_WORK.md`
- `docs/development/CODEX_HANDOFF_PHASE11.md`
- `docs/development/CODEX_HANDOFF.md`
- `docs/development/SESSION_HANDOFF.md`
- `docs/development/NEXT_STEPS.md`
- `docs/validation/phase-11/COMPLETION_MATRIX.md`
- the relevant Phase 11 production enablement/acceptance record

Record exact successful Run/Action/Task/Worker Attempt/Action Attempt/Observation IDs, request accounting, Vercel evidence, and Oracle cleanup result.

Then remove:

`public/.well-known/scopeforge-verification.txt`

Set documented progress to:

- Phase 11 source: 100%
- Phase 11 operational acceptance: 100%
- overall Phase 11 completion task: 100%

Recalculate the whole-project percentage from the actual roadmap instead of blindly changing 90%.

If the successful closure diff contains only documentation changes plus deletion of the temporary verification file, use `[skip ci]` commits and do not consume a full CI run merely for paperwork. Review the diff carefully and verify the resulting Vercel production deployment instead. If any executable code, configuration, migration, authorization, worker, or policy file changed, require the appropriate exact-head CI gate and do not bypass a failure.

Open a closure PR, review the exact diff, merge only after the required exact-head CI is green, then verify the exact-main Vercel deployment reaches READY and `scopeforge.dev` serves that main.

If Phase 11 closure is successful and a genuine delete-ref capability is available, recheck `git worktree list` plus open PRs and delete the already-reviewed safe refs in `docs/development/BRANCH_CLEANUP_CANDIDATES.md`. Do not spend the closure run classifying additional branches and do not force-move refs.

Confirm:

- no open closure PR
- no active Phase 11 task
- worker remains enabled
- the temporary verification path is gone
- Phase 11 is documented operationally complete

### I. If the canary fails

Do not run another canary.

Use the one failed canary as the debugging fixture. Diagnose and fix the confirmed root cause with a regression test, deploy the fix, and document why the single run could not close Phase 11. Preserve every canary row.

If the fix itself is complete but another live canary would be required, stop there. A second canary is outside this one-run authorization.

## Done condition

A successful Codex run ends with:

- exactly one new production canary
- that canary accepted end to end
- Oracle cleanup proven
- temporary verification proof removed
- exact evidence recorded
- closure PR green and merged
- exact-main production READY
- Phase 11 source 100%
- Phase 11 operational 100%
- Phase 11 completion task 100%
- no open closure PR
- no active Phase 11 task

Anything short of those conditions must be reported precisely rather than called complete.
